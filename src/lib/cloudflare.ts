/**
 * Cloudflare Pages API モジュール
 * Direct Upload API を使用してデプロイ
 */

import {
  type CloudflarePagesDeployment,
  CloudflarePagesDeploymentResponseSchema,
  type CloudflarePagesProject,
  CloudflarePagesProjectListResponseSchema,
  CloudflarePagesProjectResponseSchema,
} from "@/schemas/cloudflare";
import ky from "ky";
import { nanoid } from "nanoid";
import { ResultAsync } from "neverthrow";
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
const CLIPSHIP_PROJECT_PREFIX = "clipship-";

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
 * ClipShip 用のプロジェクトを検索
 */
function findClipShipProject(
  token: string,
  accountId: string,
): ResultAsync<CloudflarePagesProject | null, DeployError> {
  return listProjects(token, accountId).map((projects) => {
    const clipshipProject = projects.find((project) =>
      project.name.startsWith(CLIPSHIP_PROJECT_PREFIX),
    );
    return clipshipProject ?? null;
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
 * 新規 ClipShip プロジェクトを作成
 */
function createClipShipProject(
  token: string,
  accountId: string,
): ResultAsync<CloudflarePagesProject, DeployError> {
  const projectName = `${CLIPSHIP_PROJECT_PREFIX}${nanoid()}`;

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
    findExisting: () => findClipShipProject(token, accountId),
    create: () => createClipShipProject(token, accountId),
  };
}

/**
 * ClipShip プロジェクトを取得または作成
 */
function getOrCreateClipShipProject(
  token: string,
  accountId: string,
): ResultAsync<CloudflarePagesProject, DeployError> {
  return getOrCreateProject(createCloudflareProjectManager(token, accountId));
}

/**
 * Direct Upload でデプロイを作成
 */
function createDeployment(
  token: string,
  accountId: string,
  projectName: string,
  filePath: string,
  content: string,
  fileHash: string,
): ResultAsync<CloudflarePagesDeployment, DeployError> {
  // FormData を構築
  const formData = new FormData();

  // manifest: ファイルパス → ハッシュ のマッピング
  const manifest: Record<string, string> = {
    [`/${filePath}`]: fileHash,
  };
  formData.append("manifest", JSON.stringify(manifest));

  // ファイルをアップロード (ハッシュ値をキーとして)
  const fileBlob = new Blob([content], { type: "text/html" });
  formData.append(fileHash, fileBlob, filePath);

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

  return getOrCreateClipShipProject(token, accountId).andThen((project) =>
    // ファイルハッシュを計算
    ResultAsync.fromSafePromise(sha256(processed.content)).andThen(
      (fileHash) => {
        onProgress?.("Creating deployment...");

        return createDeployment(
          token,
          accountId,
          project.name,
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
  );
}
