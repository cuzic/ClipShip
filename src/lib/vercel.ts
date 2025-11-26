/**
 * Vercel API モジュール
 * インラインファイルデプロイを使用
 */

import {
  type VercelDeployment,
  VercelDeploymentSchema,
  type VercelProject,
  VercelProjectSchema,
} from "@/schemas/vercel";
import ky, { HTTPError } from "ky";
import { nanoid } from "nanoid";
import { ResultAsync } from "neverthrow";
import { z } from "zod";
import { ApiError, AuthenticationError, type DeployError } from "./errors";
import { processContent } from "./html";
import { getStorageData, setStorageData } from "./storage";

const VERCEL_API_URL = "https://api.vercel.com";
const CLIPSHIP_PROJECT_PREFIX = "clipship-";

/**
 * HTTPError を DeployError に変換
 */
function mapHttpError(error: HTTPError): DeployError {
  if (error.response.status === 401 || error.response.status === 403) {
    return AuthenticationError.invalidToken("Vercel" as "Netlify" | "GitHub");
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
): ResultAsync<VercelProject[], DeployError> {
  return ResultAsync.fromPromise(
    ky
      .get(`${VERCEL_API_URL}/v10/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .json()
      .then((response) => {
        const parsed = z
          .object({ projects: z.array(VercelProjectSchema) })
          .parse(response);
        return parsed.projects;
      }),
    mapUnknownError,
  );
}

/**
 * ClipShip 用のプロジェクトを検索
 */
function findClipShipProject(
  token: string,
): ResultAsync<VercelProject | null, DeployError> {
  return listProjects(token).map((projects) => {
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
  projectId: string,
): ResultAsync<VercelProject, DeployError> {
  return ResultAsync.fromPromise(
    ky
      .get(`${VERCEL_API_URL}/v9/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .json()
      .then((response) => VercelProjectSchema.parse(response)),
    mapUnknownError,
  );
}

/**
 * 新規 ClipShip プロジェクトを作成
 */
function createClipShipProject(
  token: string,
): ResultAsync<VercelProject, DeployError> {
  const projectName = `${CLIPSHIP_PROJECT_PREFIX}${nanoid()}`;

  return ResultAsync.fromPromise(
    ky
      .post(`${VERCEL_API_URL}/v11/projects`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        json: { name: projectName },
      })
      .json()
      .then((response) => VercelProjectSchema.parse(response)),
    mapUnknownError,
  );
}

/**
 * ClipShip プロジェクトを取得または作成
 */
async function getOrCreateClipShipProject(
  token: string,
): Promise<ResultAsync<VercelProject, DeployError>> {
  // 1. storage から取得
  const storedProjectId = await getStorageData("vercelProjectId");
  if (storedProjectId) {
    const projectResult = await getProject(token, storedProjectId);
    if (projectResult.isOk()) {
      return ResultAsync.fromSafePromise(Promise.resolve(projectResult.value));
    }
    // プロジェクトが削除されている可能性があるので続行
  }

  // 2. 既存の clipship-* プロジェクトを検索
  const existingProjectResult = await findClipShipProject(token);
  if (existingProjectResult.isOk() && existingProjectResult.value) {
    await setStorageData("vercelProjectId", existingProjectResult.value.id);
    return ResultAsync.fromSafePromise(
      Promise.resolve(existingProjectResult.value),
    );
  }

  // 3. 新規作成
  return createClipShipProject(token).map(async (project) => {
    await setStorageData("vercelProjectId", project.id);
    return project;
  });
}

/**
 * インラインファイルでデプロイを作成
 */
function createDeployment(
  token: string,
  projectName: string,
  filePath: string,
  content: string,
): ResultAsync<VercelDeployment, DeployError> {
  return ResultAsync.fromPromise(
    ky
      .post(`${VERCEL_API_URL}/v13/deployments`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        json: {
          name: projectName,
          files: [
            {
              file: filePath,
              data: content,
              encoding: "utf-8",
            },
          ],
          projectSettings: {
            framework: null,
          },
        },
      })
      .json()
      .then((response) => VercelDeploymentSchema.parse(response)),
    mapUnknownError,
  );
}

/**
 * Vercel デプロイ結果の型
 */
interface VercelDeployResult {
  projectId: string;
  projectName: string;
  deployUrl: string;
}

/**
 * Vercel にデプロイする (Result版)
 */
export async function deployToVercelResult(
  token: string,
  content: string,
  onProgress?: (message: string) => void,
): Promise<ResultAsync<VercelDeployResult, DeployError>> {
  if (onProgress) {
    onProgress("Preparing project...");
  }

  // プロジェクトを取得または作成
  const projectResultAsync = await getOrCreateClipShipProject(token);
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

  if (onProgress) {
    onProgress("Creating deployment...");
  }

  // デプロイを作成
  const deployResult = await createDeployment(
    token,
    project.name,
    filePath,
    processed.content,
  );

  if (deployResult.isErr()) {
    return ResultAsync.fromPromise(
      Promise.reject(deployResult.error),
      () => deployResult.error,
    );
  }

  const deployment = deployResult.value;

  // 最終 URL を構築
  const deployUrl = `https://${deployment.url}/${filePath}`;

  return ResultAsync.fromSafePromise(
    Promise.resolve({
      projectId: project.id,
      projectName: project.name,
      deployUrl,
    }),
  );
}

/**
 * Vercel にデプロイする (後方互換性のため維持)
 * @deprecated deployToVercelResult を使用してください
 */
export async function deployToVercel(
  token: string,
  content: string,
  onProgress?: (message: string) => void,
): Promise<VercelDeployResult> {
  const resultAsync = await deployToVercelResult(token, content, onProgress);
  const result = await resultAsync;

  if (result.isErr()) {
    throw result.error;
  }

  return result.value;
}
