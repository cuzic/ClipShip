/**
 * Cloudflare Pages API モジュール
 * Direct Upload API を使用してデプロイ
 */

import {
  type CloudflarePagesDeployment,
  type CloudflarePagesDeploymentFile,
  CloudflarePagesDeploymentFilesResponseSchema,
  CloudflarePagesDeploymentResponseSchema,
  type CloudflarePagesProject,
  CloudflarePagesProjectListResponseSchema,
  CloudflarePagesProjectResponseSchema,
} from "@/schemas/cloudflare";
import ky from "ky";
import { nanoid } from "nanoid";
import { ResultAsync } from "neverthrow";
import { z } from "zod";
import {
  type ProjectManager,
  createUnknownErrorMapper,
  getOrCreateProject,
} from "./deploy-utils";
import type { DeployError } from "./errors";
import { sha256 } from "./hash";
import { processContent } from "./html";
import { type CssTheme, getStorageData, setStorageData } from "./storage";

const CLOUDFLARE_API_URL = "https://api.cloudflare.com/client/v4";
const PASTEHOST_PROJECT_PREFIX = "pastehost-";

// 共通エラーマッパー
const mapUnknownError = createUnknownErrorMapper("Cloudflare");

/**
 * プロジェクト一覧を取得
 */
function listProjects(
  token: string,
  accountId: string,
): ResultAsync<CloudflarePagesProject[], DeployError> {
  return ResultAsync.fromPromise(
    ky
      .get(`${CLOUDFLARE_API_URL}/accounts/${accountId}/pages/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .json()
      .then((response) => {
        const parsed = CloudflarePagesProjectListResponseSchema.parse(response);
        if (!parsed.success) {
          throw new Error(parsed.errors[0]?.message || "API error");
        }
        return parsed.result;
      }),
    mapUnknownError,
  );
}

/**
 * PasteHost 用のプロジェクトを検索
 */
function findPasteHostProject(
  token: string,
  accountId: string,
): ResultAsync<CloudflarePagesProject | null, DeployError> {
  return listProjects(token, accountId).map((projects) => {
    const pastehostProject = projects.find((project) =>
      project.name.startsWith(PASTEHOST_PROJECT_PREFIX),
    );
    return pastehostProject ?? null;
  });
}

/**
 * プロジェクト情報を取得
 */
function getProject(
  token: string,
  accountId: string,
  projectName: string,
): ResultAsync<CloudflarePagesProject, DeployError> {
  return ResultAsync.fromPromise(
    ky
      .get(
        `${CLOUDFLARE_API_URL}/accounts/${accountId}/pages/projects/${projectName}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      )
      .json()
      .then((response) => {
        const parsed = CloudflarePagesProjectResponseSchema.parse(response);
        if (!parsed.success) {
          throw new Error(parsed.errors[0]?.message || "API error");
        }
        return parsed.result;
      }),
    mapUnknownError,
  );
}

/**
 * 新規 PasteHost プロジェクトを作成
 */
function createPasteHostProject(
  token: string,
  accountId: string,
): ResultAsync<CloudflarePagesProject, DeployError> {
  const projectName = `${PASTEHOST_PROJECT_PREFIX}${nanoid()}`;

  return ResultAsync.fromPromise(
    ky
      .post(`${CLOUDFLARE_API_URL}/accounts/${accountId}/pages/projects`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        json: {
          name: projectName,
          production_branch: "main",
        },
      })
      .json()
      .then((response) => {
        const parsed = CloudflarePagesProjectResponseSchema.parse(response);
        if (!parsed.success) {
          throw new Error(parsed.errors[0]?.message || "API error");
        }
        return parsed.result;
      }),
    mapUnknownError,
  );
}

/**
 * Cloudflare プロジェクト管理用の ProjectManager を作成
 */
function createCloudflareProjectManager(
  token: string,
  accountId: string,
): ProjectManager<CloudflarePagesProject> {
  return {
    getFromStorage: () => getStorageData("cloudflareProjectId"),
    saveToStorage: (name: string) =>
      setStorageData("cloudflareProjectId", name),
    getById: (name: string) => getProject(token, accountId, name),
    findExisting: () => findPasteHostProject(token, accountId),
    create: () => createPasteHostProject(token, accountId),
  };
}

/**
 * PasteHost プロジェクトを取得または作成
 */
function getOrCreatePasteHostProject(
  token: string,
  accountId: string,
): ResultAsync<CloudflarePagesProject, DeployError> {
  return getOrCreateProject(createCloudflareProjectManager(token, accountId));
}

/**
 * プロジェクトの最新デプロイからファイル一覧を取得
 */
function getLatestDeploymentFiles(
  token: string,
  accountId: string,
  projectName: string,
): ResultAsync<CloudflarePagesDeploymentFile[], DeployError> {
  // まずプロジェクトの最新デプロイを取得
  return ResultAsync.fromPromise(
    ky
      .get(
        `${CLOUDFLARE_API_URL}/accounts/${accountId}/pages/projects/${projectName}/deployments`,
        {
          headers: { Authorization: `Bearer ${token}` },
          searchParams: { per_page: 1 },
        },
      )
      .json()
      .then((response) => {
        const parsed = z
          .object({
            success: z.boolean(),
            result: z.array(z.object({ id: z.string() })),
          })
          .parse(response);
        if (!parsed.success || parsed.result.length === 0) {
          return [];
        }
        return parsed.result;
      }),
    mapUnknownError,
  ).andThen((deployments) => {
    if (deployments.length === 0) {
      return ResultAsync.fromSafePromise(Promise.resolve([]));
    }

    const latestDeploymentId = deployments[0].id;

    // 最新デプロイのファイル一覧を取得
    return ResultAsync.fromPromise(
      ky
        .get(
          `${CLOUDFLARE_API_URL}/accounts/${accountId}/pages/projects/${projectName}/deployments/${latestDeploymentId}/files`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        )
        .json()
        .then((response) => {
          const parsed =
            CloudflarePagesDeploymentFilesResponseSchema.parse(response);
          if (!parsed.success) {
            return [];
          }
          return parsed.result;
        }),
      mapUnknownError,
    ).orElse(() => ResultAsync.fromSafePromise(Promise.resolve([])));
  });
}

/**
 * パスを正規化（先頭に / を付ける）
 */
function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

/**
 * 既存ファイルと新しいファイルをマージしてマニフェストを作成
 */
function createMergedManifest(
  existingFiles: CloudflarePagesDeploymentFile[],
  newFilePath: string,
  newFileHash: string,
): Record<string, string> {
  const manifest: Record<string, string> = {};

  // 既存ファイルを追加（パスを正規化）
  for (const file of existingFiles) {
    manifest[normalizePath(file.path)] = file.hash;
  }

  // 新しいファイルを追加（上書き、パスを正規化）
  manifest[normalizePath(newFilePath)] = newFileHash;

  return manifest;
}

/**
 * Direct Upload でデプロイを作成（既存ファイルをマージ）
 */
function createDeploymentWithMergedFiles(
  token: string,
  accountId: string,
  projectName: string,
  manifest: Record<string, string>,
  newFilePath: string,
  newFileContent: string,
  newFileHash: string,
): ResultAsync<CloudflarePagesDeployment, DeployError> {
  // FormData を構築
  const formData = new FormData();

  // マニフェストを追加
  formData.append("manifest", JSON.stringify(manifest));

  // 新しいファイルのみアップロード (ハッシュ値をキーとして)
  const fileBlob = new Blob([newFileContent], { type: "text/html" });
  formData.append(newFileHash, fileBlob, newFilePath);

  return ResultAsync.fromPromise(
    ky
      .post(
        `${CLOUDFLARE_API_URL}/accounts/${accountId}/pages/projects/${projectName}/deployments`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      )
      .json()
      .then((response) => {
        const parsed = CloudflarePagesDeploymentResponseSchema.parse(response);
        if (!parsed.success) {
          throw new Error(parsed.errors[0]?.message || "API error");
        }
        return parsed.result;
      }),
    mapUnknownError,
  );
}

/**
 * Cloudflare Pages デプロイ結果の型
 */
interface CloudflareDeployResult {
  projectId: string;
  projectName: string;
  deployUrl: string;
}

/**
 * Cloudflare Pages にデプロイする
 */
export function deployToCloudflare(
  token: string,
  accountId: string,
  content: string,
  onProgress?: (message: string) => void,
  theme: CssTheme = "default",
): ResultAsync<CloudflareDeployResult, DeployError> {
  // ランダムなサブディレクトリ名を生成
  const subdir = nanoid();
  const processed = processContent(content, theme);
  const filePath = `${subdir}/${processed.filename}`;

  onProgress?.("Preparing project...");

  return getOrCreatePasteHostProject(token, accountId).andThen((project) =>
    // 既存ファイル一覧を取得
    getLatestDeploymentFiles(token, accountId, project.name).andThen(
      (existingFiles) =>
        // ファイルハッシュを計算
        ResultAsync.fromSafePromise(sha256(processed.content)).andThen(
          (fileHash) => {
            // 既存ファイルと新しいファイルをマージしてマニフェストを作成
            const manifest = createMergedManifest(
              existingFiles,
              filePath,
              fileHash,
            );

            onProgress?.("Creating deployment...");

            return createDeploymentWithMergedFiles(
              token,
              accountId,
              project.name,
              manifest,
              filePath,
              processed.content,
              fileHash,
            ).map((deployment) => ({
              projectId: project.id,
              projectName: project.name,
              deployUrl: `${deployment.url}/${filePath}`,
            }));
          },
        ),
    ),
  );
}
