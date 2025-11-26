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
import ky, { HTTPError } from "ky";
import { nanoid } from "nanoid";
import { ResultAsync } from "neverthrow";
import { z } from "zod";
import {
  ApiError,
  AuthenticationError,
  type DeployError,
  PermissionError,
} from "./errors";
import { processContent } from "./html";
import { getStorageData, setStorageData } from "./storage";

const CLOUDFLARE_API_URL = "https://api.cloudflare.com/client/v4";
const CLIPSHIP_PROJECT_PREFIX = "clipship-";

/**
 * SHA-256 ハッシュを計算
 */
async function sha256(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * HTTPError を DeployError に変換
 */
function mapHttpError(error: HTTPError): DeployError {
  if (error.response.status === 401) {
    return AuthenticationError.invalidToken("GitHub"); // 近い型を使用
  }
  if (error.response.status === 403) {
    return PermissionError.insufficientScope("Pages: Edit");
  }
  return ApiError.fromStatus(error.response.status);
}

/**
 * unknown エラーを DeployError に変換
 */
function mapUnknownError(error: unknown): DeployError {
  if (error instanceof HTTPError) {
    return mapHttpError(error);
  }
  if (error instanceof Error) {
    return new ApiError(error.message);
  }
  return new ApiError("Unknown error occurred");
}

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
 * ClipShip プロジェクトを取得または作成
 */
async function getOrCreateClipShipProject(
  token: string,
  accountId: string,
): Promise<ResultAsync<CloudflarePagesProject, DeployError>> {
  // 1. storage から取得
  const storedProjectId = await getStorageData("cloudflareProjectId");
  if (storedProjectId) {
    const projectResult = await getProject(token, accountId, storedProjectId);
    if (projectResult.isOk()) {
      return ResultAsync.fromSafePromise(Promise.resolve(projectResult.value));
    }
    // プロジェクトが削除されている可能性があるので続行
  }

  // 2. 既存の clipship-* プロジェクトを検索
  const existingProjectResult = await findClipShipProject(token, accountId);
  if (existingProjectResult.isOk() && existingProjectResult.value) {
    await setStorageData(
      "cloudflareProjectId",
      existingProjectResult.value.name,
    );
    return ResultAsync.fromSafePromise(
      Promise.resolve(existingProjectResult.value),
    );
  }

  // 3. 新規作成
  return createClipShipProject(token, accountId).map(async (project) => {
    await setStorageData("cloudflareProjectId", project.name);
    return project;
  });
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
 * Cloudflare Pages にデプロイする (Result版)
 */
export async function deployToCloudflareResult(
  token: string,
  accountId: string,
  content: string,
  onProgress?: (message: string) => void,
): Promise<ResultAsync<CloudflareDeployResult, DeployError>> {
  if (onProgress) {
    onProgress("Preparing project...");
  }

  // プロジェクトを取得または作成
  const projectResultAsync = await getOrCreateClipShipProject(token, accountId);
  const projectResult = await projectResultAsync;

  if (projectResult.isErr()) {
    return ResultAsync.fromPromise(
      Promise.reject(projectResult.error),
      () => projectResult.error,
    );
  }

  const project = projectResult.value;

  // ランダムなサブディレクトリ名を生成
  const subdir = nanoid();
  const processed = processContent(content);
  const filePath = `${subdir}/${processed.filename}`;

  // ファイルハッシュを計算
  const fileHash = await sha256(processed.content);

  if (onProgress) {
    onProgress("Creating deployment...");
  }

  // デプロイを作成
  const deployResult = await createDeployment(
    token,
    accountId,
    project.name,
    filePath,
    processed.content,
    fileHash,
  );

  if (deployResult.isErr()) {
    return ResultAsync.fromPromise(
      Promise.reject(deployResult.error),
      () => deployResult.error,
    );
  }

  const deployment = deployResult.value;

  // 最終 URL を構築
  const deployUrl = `${deployment.url}/${filePath}`;

  return ResultAsync.fromSafePromise(
    Promise.resolve({
      projectId: project.id,
      projectName: project.name,
      deployUrl,
    }),
  );
}

/**
 * Cloudflare Pages にデプロイする (後方互換性のため維持)
 * @deprecated deployToCloudflareResult を使用してください
 */
export async function deployToCloudflare(
  token: string,
  accountId: string,
  content: string,
  onProgress?: (message: string) => void,
): Promise<CloudflareDeployResult> {
  const resultAsync = await deployToCloudflareResult(
    token,
    accountId,
    content,
    onProgress,
  );
  const result = await resultAsync;

  if (result.isErr()) {
    throw result.error;
  }

  return result.value;
}
