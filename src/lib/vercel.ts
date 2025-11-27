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
import { processContent } from "./html";
import { type CssTheme, getStorageData, setStorageData } from "./storage";

const VERCEL_API_URL = "https://api.vercel.com";
const CLIPSHIP_PROJECT_PREFIX = "clipship-";

// 共通エラーマッパー
const mapUnknownError = createUnknownErrorMapper("Vercel");

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
 * Vercel プロジェクト管理用の ProjectManager を作成
 */
function createVercelProjectManager(
  token: string,
): ProjectManager<VercelProject> {
  return {
    getFromStorage: () => getStorageData("vercelProjectId"),
    saveToStorage: (id: string) => setStorageData("vercelProjectId", id),
    getById: (id: string) => getProject(token, id),
    findExisting: () => findClipShipProject(token),
    create: () => createClipShipProject(token),
  };
}

/**
 * ClipShip プロジェクトを取得または作成
 */
function getOrCreateClipShipProject(
  token: string,
): ResultAsync<VercelProject, DeployError> {
  return getOrCreateProject(createVercelProjectManager(token));
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
export function deployToVercelResult(
  token: string,
  content: string,
  onProgress?: (message: string) => void,
  theme: CssTheme = "default",
): ResultAsync<VercelDeployResult, DeployError> {
  // ランダムなサブディレクトリ名を生成
  const subdir = nanoid();
  const processed = processContent(content, theme);
  const filePath = `${subdir}/${processed.filename}`;

  onProgress?.("Preparing project...");

  return getOrCreateClipShipProject(token).andThen((project) => {
    onProgress?.("Creating deployment...");

    return createDeployment(
      token,
      project.name,
      filePath,
      processed.content,
    ).map((deployment) => ({
      projectId: project.id,
      projectName: project.name,
      deployUrl: `https://${deployment.url}/${filePath}`,
    }));
  });
}

/**
 * Vercel にデプロイする (後方互換性のため維持)
 * @deprecated deployToVercelResult を使用してください
 */
export async function deployToVercel(
  token: string,
  content: string,
  onProgress?: (message: string) => void,
  theme: CssTheme = "default",
): Promise<VercelDeployResult> {
  const result = await deployToVercelResult(token, content, onProgress, theme);

  if (result.isErr()) {
    throw result.error;
  }

  return result.value;
}
