/**
 * Netlify API モジュール
 * File Digest API を使用してデプロイを行う
 */

import { type NetlifySite, NetlifySiteSchema } from "@/schemas/netlify";
import ky from "ky";
import { nanoid } from "nanoid";
import { ResultAsync, errAsync, okAsync } from "neverthrow";
import { z } from "zod";
import {
  type ProjectManager,
  createUnknownErrorMapper,
  getOrCreateProject,
} from "./deploy-utils";
import { ApiError, type DeployError } from "./errors";
import { sha1 } from "./hash";
import { processContent } from "./html";
import { type CssTheme, getStorageData, setStorageData } from "./storage";

const NETLIFY_API_URL = "https://api.netlify.com/api/v1/sites";
const NETLIFY_DEPLOYS_API_URL = "https://api.netlify.com/api/v1/deploys";
const POLL_INTERVAL_MS = 1000;
const MAX_POLL_ATTEMPTS = 60;
const PASTEHOST_SITE_PREFIX = "pastehost-";

// 共通エラーマッパー
const mapUnknownError = createUnknownErrorMapper("Netlify");

/**
 * 指定時間待機
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * デプロイスキーマ (deploy オブジェクト用)
 */
const DeploySchema = z.object({
  id: z.string(),
  state: z.string(),
  ssl_url: z.string().optional(),
  url: z.string().optional(),
  required: z.array(z.string()).optional(),
});

type Deploy = z.infer<typeof DeploySchema>;

/**
 * デプロイファイル一覧のスキーマ
 */
const DeployFileSchema = z.object({
  id: z.string(),
  path: z.string(),
  sha: z.string(),
});

type DeployFile = z.infer<typeof DeployFileSchema>;

/**
 * ファイル情報の型
 */
interface FileInfo {
  path: string;
  content: string;
  hash: string;
}

/**
 * デプロイ結果の型
 */
interface NetlifyDeployResult {
  siteId: string;
  siteName: string;
  deployUrl: string;
}

/**
 * 全サイトを取得
 */
function listSites(token: string): ResultAsync<NetlifySite[], DeployError> {
  return ResultAsync.fromPromise(
    ky
      .get(NETLIFY_API_URL, {
        headers: { Authorization: `Bearer ${token}` },
        searchParams: { filter: "all" },
      })
      .json()
      .then((response) => z.array(NetlifySiteSchema).parse(response)),
    mapUnknownError,
  );
}

/**
 * PasteHost 用のサイトを検索
 */
function findPasteHostSite(
  token: string,
): ResultAsync<NetlifySite | null, DeployError> {
  return listSites(token).map((sites) => {
    const pastehostSite = sites.find((site) =>
      site.name.startsWith(PASTEHOST_SITE_PREFIX),
    );
    return pastehostSite ?? null;
  });
}

/**
 * サイト情報を取得
 */
function getSite(
  token: string,
  siteId: string,
): ResultAsync<NetlifySite, DeployError> {
  return ResultAsync.fromPromise(
    ky
      .get(`${NETLIFY_API_URL}/${siteId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .json()
      .then((response) => NetlifySiteSchema.parse(response)),
    mapUnknownError,
  );
}

/**
 * 新規 PasteHost サイトを作成
 */
function createPasteHostSite(
  token: string,
): ResultAsync<NetlifySite, DeployError> {
  const siteName = `${PASTEHOST_SITE_PREFIX}${nanoid()}`;

  return ResultAsync.fromPromise(
    ky
      .post(NETLIFY_API_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        json: { name: siteName },
      })
      .json()
      .then((response) => NetlifySiteSchema.parse(response)),
    mapUnknownError,
  );
}

/**
 * Netlify サイト管理用の ProjectManager を作成
 */
function createNetlifySiteManager(token: string): ProjectManager<NetlifySite> {
  return {
    getFromStorage: () => getStorageData("netlifySiteId"),
    saveToStorage: (id: string) => setStorageData("netlifySiteId", id),
    getById: (id: string) => getSite(token, id),
    findExisting: () => findPasteHostSite(token),
    create: () => createPasteHostSite(token),
  };
}

/**
 * サイトの現在のデプロイからファイル一覧を取得
 */
function getSiteFiles(
  token: string,
  siteId: string,
): ResultAsync<DeployFile[], DeployError> {
  return ResultAsync.fromPromise(
    ky
      .get(`${NETLIFY_API_URL}/${siteId}/files`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .json()
      .then((response) => z.array(DeployFileSchema).parse(response)),
    mapUnknownError,
  ).orElse(() => okAsync([])); // ファイルがない場合は空配列を返す
}

/**
 * PasteHost サイトを取得または作成
 */
function getOrCreatePasteHostSite(
  token: string,
): ResultAsync<NetlifySite, DeployError> {
  return getOrCreateProject(createNetlifySiteManager(token));
}

/**
 * デプロイの状態を取得
 */
function getDeploy(
  token: string,
  deployId: string,
): ResultAsync<Deploy, DeployError> {
  return ResultAsync.fromPromise(
    ky
      .get(`${NETLIFY_DEPLOYS_API_URL}/${deployId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .json()
      .then((response) => DeploySchema.parse(response)),
    mapUnknownError,
  );
}

/**
 * デプロイが ready になるまでポーリング
 */
function waitForDeployReady(
  token: string,
  deployId: string,
  onProgress?: (state: string) => void,
): ResultAsync<Deploy, DeployError> {
  return ResultAsync.fromSafePromise(
    pollDeployStatus(token, deployId, onProgress),
  ).andThen((result) => result);
}

/**
 * デプロイ状態のポーリング処理（内部実装）
 */
async function pollDeployStatus(
  token: string,
  deployId: string,
  onProgress?: (state: string) => void,
): Promise<ResultAsync<Deploy, DeployError>> {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    const result = await getDeploy(token, deployId).match(
      (deploy) => {
        onProgress?.(deploy.state);
        if (deploy.state === "ready") {
          return {
            done: true as const,
            value: okAsync<Deploy, DeployError>(deploy),
          };
        }
        if (deploy.state === "error") {
          return {
            done: true as const,
            value: errAsync<Deploy, DeployError>(ApiError.deployFailed()),
          };
        }
        return { done: false as const };
      },
      (error) => ({
        done: true as const,
        value: errAsync<Deploy, DeployError>(error),
      }),
    );

    if (result.done) {
      return result.value;
    }

    await sleep(POLL_INTERVAL_MS);
  }

  return errAsync(ApiError.deployTimeout());
}

/**
 * 必要なファイルをアップロード
 */
function uploadRequiredFiles(
  token: string,
  deployId: string,
  files: FileInfo[],
  requiredHashes: string[],
): ResultAsync<void, DeployError> {
  const requiredSet = new Set(requiredHashes);

  const uploadPromises = files
    .filter((file) => requiredSet.has(file.hash))
    .map((file) =>
      ky.put(`${NETLIFY_DEPLOYS_API_URL}/${deployId}/files/${file.path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
        },
        body: file.content,
      }),
    );

  return ResultAsync.fromPromise(
    Promise.all(uploadPromises).then(() => undefined),
    mapUnknownError,
  );
}

/**
 * パスを正規化（先頭に / を付ける）
 */
function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

/**
 * 既存ファイルのダイジェストを取得し、新しいファイルとマージ
 */
function createMergedFilesDigest(
  existingFiles: DeployFile[],
  newFiles: FileInfo[],
): Record<string, string> {
  const filesDigest: Record<string, string> = {};

  // 既存ファイルを追加（パスを正規化）
  for (const file of existingFiles) {
    filesDigest[normalizePath(file.path)] = file.sha;
  }

  // 新しいファイルを追加（上書き、パスを正規化）
  for (const file of newFiles) {
    filesDigest[normalizePath(file.path)] = file.hash;
  }

  return filesDigest;
}

/**
 * Netlifyにデプロイする
 */
export function deployToNetlify(
  token: string,
  content: string,
  onProgress?: (message: string) => void,
  theme: CssTheme = "default",
): ResultAsync<NetlifyDeployResult, DeployError> {
  // ランダムなサブディレクトリ名を生成
  const subdir = nanoid();
  const processed = processContent(content, theme);
  const filePath = `${subdir}/${processed.filename}`;

  onProgress?.("Preparing site...");

  return getOrCreatePasteHostSite(token).andThen((site) =>
    // 既存ファイル一覧を取得
    getSiteFiles(token, site.id).andThen((existingFiles) =>
      // ファイルハッシュを計算
      ResultAsync.fromSafePromise(sha1(processed.content)).andThen(
        (fileHash) => {
          const newFiles: FileInfo[] = [
            { path: filePath, content: processed.content, hash: fileHash },
          ];

          // 既存ファイルと新しいファイルをマージしてデプロイ
          const filesDigest = createMergedFilesDigest(existingFiles, newFiles);

          onProgress?.("Creating deploy...");

          return createDigestDeployWithMergedFiles(token, site.id, filesDigest)
            .andThen((deploy) => {
              // 必要なファイルをアップロード
              if (deploy.required && deploy.required.length > 0) {
                onProgress?.("Uploading files...");
                return uploadRequiredFiles(
                  token,
                  deploy.id,
                  newFiles,
                  deploy.required,
                ).map(() => deploy);
              }
              return okAsync(deploy);
            })
            .andThen((deploy) => {
              onProgress?.("Processing...");
              return waitForDeployReady(token, deploy.id, (state) =>
                onProgress?.(`Processing (${state})...`),
              );
            })
            .map(() => {
              const baseUrl = site.ssl_url ?? site.url;
              return {
                siteId: site.id,
                siteName: site.name,
                deployUrl: `${baseUrl}/${subdir}/${processed.filename}`,
              };
            });
        },
      ),
    ),
  );
}

/**
 * マージ済みファイルダイジェストでデプロイを作成
 */
function createDigestDeployWithMergedFiles(
  token: string,
  siteId: string,
  filesDigest: Record<string, string>,
): ResultAsync<Deploy, DeployError> {
  return ResultAsync.fromPromise(
    ky
      .post(`${NETLIFY_API_URL}/${siteId}/deploys`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        json: { files: filesDigest },
      })
      .json()
      .then((response) => DeploySchema.parse(response)),
    mapUnknownError,
  );
}
