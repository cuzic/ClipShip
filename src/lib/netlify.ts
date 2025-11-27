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
const CLIPSHIP_SITE_PREFIX = "clipship-";

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
 * ClipShip 用のサイトを検索
 */
function findClipShipSite(
  token: string,
): ResultAsync<NetlifySite | null, DeployError> {
  return listSites(token).map((sites) => {
    const clipshipSite = sites.find((site) =>
      site.name.startsWith(CLIPSHIP_SITE_PREFIX),
    );
    return clipshipSite ?? null;
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
 * 新規 ClipShip サイトを作成
 */
function createClipShipSite(
  token: string,
): ResultAsync<NetlifySite, DeployError> {
  const siteName = `${CLIPSHIP_SITE_PREFIX}${nanoid()}`;

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
    findExisting: () => findClipShipSite(token),
    create: () => createClipShipSite(token),
  };
}

/**
 * ClipShip サイトを取得または作成
 */
function getOrCreateClipShipSite(
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
    const deployResult = await getDeploy(token, deployId);

    if (deployResult.isErr()) {
      return errAsync(deployResult.error);
    }

    const deploy = deployResult.value;
    onProgress?.(deploy.state);

    if (deploy.state === "ready") {
      return okAsync(deploy);
    }

    if (deploy.state === "error") {
      return errAsync(ApiError.deployFailed());
    }

    await sleep(POLL_INTERVAL_MS);
  }

  return errAsync(ApiError.deployTimeout());
}

/**
 * File Digest API でデプロイを作成
 */
function createDigestDeploy(
  token: string,
  siteId: string,
  files: FileInfo[],
): ResultAsync<Deploy, DeployError> {
  const filesDigest: Record<string, string> = {};
  for (const file of files) {
    filesDigest[`/${file.path}`] = file.hash;
  }

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
 * Netlifyにデプロイする (Result版)
 */
export function deployToNetlifyResult(
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

  return getOrCreateClipShipSite(token).andThen((site) =>
    // ファイルハッシュを計算
    ResultAsync.fromSafePromise(sha1(processed.content)).andThen((fileHash) => {
      const files: FileInfo[] = [
        { path: filePath, content: processed.content, hash: fileHash },
      ];

      onProgress?.("Creating deploy...");

      return createDigestDeploy(token, site.id, files)
        .andThen((deploy) => {
          // 必要なファイルをアップロード
          if (deploy.required && deploy.required.length > 0) {
            onProgress?.("Uploading files...");
            return uploadRequiredFiles(
              token,
              deploy.id,
              files,
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
    }),
  );
}

/**
 * Netlifyにデプロイする (後方互換性のため維持)
 * @deprecated deployToNetlifyResult を使用してください
 */
export async function deployToNetlify(
  token: string,
  content: string,
  onProgress?: (message: string) => void,
  theme: CssTheme = "default",
): Promise<NetlifyDeployResult> {
  const result = await deployToNetlifyResult(token, content, onProgress, theme);

  if (result.isErr()) {
    throw result.error;
  }

  return result.value;
}
