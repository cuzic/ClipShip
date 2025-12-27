/**
 * Vercel API モジュール
 * インラインファイルデプロイを使用
 */

import {
  type VercelDeployment,
  type VercelDeploymentFile,
  VercelDeploymentFileSchema,
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
const PASTEHOST_PROJECT_PREFIX = "pastehost-";

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
 * PasteHost 用のプロジェクトを検索
 */
function findPasteHostProject(
  token: string,
): ResultAsync<VercelProject | null, DeployError> {
  return listProjects(token).map((projects) => {
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
 * 新規 PasteHost プロジェクトを作成
 */
function createPasteHostProject(
  token: string,
): ResultAsync<VercelProject, DeployError> {
  const projectName = `${PASTEHOST_PROJECT_PREFIX}${nanoid()}`;

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
    findExisting: () => findPasteHostProject(token),
    create: () => createPasteHostProject(token),
  };
}

/**
 * PasteHost プロジェクトを取得または作成
 */
function getOrCreatePasteHostProject(
  token: string,
): ResultAsync<VercelProject, DeployError> {
  return getOrCreateProject(createVercelProjectManager(token));
}

/**
 * 既存ファイルのUID情報を保持する型
 */
interface ExistingFileInfo {
  file: string;
  sha: string;
}

/**
 * プロジェクトの最新デプロイからファイル一覧を取得
 */
function getLatestDeploymentFiles(
  token: string,
  projectId: string,
): ResultAsync<ExistingFileInfo[], DeployError> {
  // まずプロジェクトの最新デプロイを取得
  return ResultAsync.fromPromise(
    ky
      .get(`${VERCEL_API_URL}/v6/deployments`, {
        headers: { Authorization: `Bearer ${token}` },
        searchParams: { projectId, limit: 1, state: "READY" },
      })
      .json()
      .then((response) => {
        const parsed = z
          .object({
            deployments: z.array(z.object({ uid: z.string() })),
          })
          .parse(response);
        return parsed.deployments;
      }),
    mapUnknownError,
  ).andThen((deployments) => {
    if (deployments.length === 0) {
      return ResultAsync.fromSafePromise(Promise.resolve([]));
    }

    const latestDeploymentId = deployments[0].uid;

    // 最新デプロイのファイル一覧を取得
    return ResultAsync.fromPromise(
      ky
        .get(`${VERCEL_API_URL}/v6/deployments/${latestDeploymentId}/files`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .json()
        .then((response) => {
          const files = z.array(VercelDeploymentFileSchema).parse(response);
          // ファイルのみをフィルタリングして、パスと uid を返す
          return collectFilesRecursively(token, latestDeploymentId, files, "");
        }),
      mapUnknownError,
    ).orElse(() => ResultAsync.fromSafePromise(Promise.resolve([])));
  });
}

/**
 * ディレクトリを再帰的に探索してファイル一覧を収集
 */
async function collectFilesRecursively(
  token: string,
  deploymentId: string,
  files: VercelDeploymentFile[],
  basePath: string,
): Promise<ExistingFileInfo[]> {
  const result: ExistingFileInfo[] = [];

  for (const file of files) {
    const filePath = basePath ? `${basePath}/${file.name}` : file.name;

    if (file.type === "file" && file.uid) {
      result.push({
        file: filePath,
        sha: file.uid,
      });
    } else if (file.type === "directory") {
      // ディレクトリの場合は中身を取得
      try {
        const dirFiles = await ky
          .get(
            `${VERCEL_API_URL}/v6/deployments/${deploymentId}/files/${encodeURIComponent(filePath)}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          )
          .json();
        const parsed = z.array(VercelDeploymentFileSchema).parse(dirFiles);
        const subFiles = await collectFilesRecursively(
          token,
          deploymentId,
          parsed,
          filePath,
        );
        result.push(...subFiles);
      } catch (error) {
        // ディレクトリの取得に失敗した場合はスキップ（ログ出力）
        console.warn(
          `Failed to fetch directory contents: ${filePath}`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  return result;
}

/**
 * Vercel デプロイ用のファイルエントリ型
 */
type VercelFileEntry =
  | { file: string; data: string; encoding: "utf-8" }
  | { file: string; sha: string };

/**
 * 既存ファイルと新しいファイルをマージ
 */
function mergeFilesForDeployment(
  existingFiles: ExistingFileInfo[],
  newFilePath: string,
  newFileContent: string,
): VercelFileEntry[] {
  const files: VercelFileEntry[] = [];

  // 既存ファイルを sha 参照で追加
  for (const file of existingFiles) {
    files.push({
      file: file.file,
      sha: file.sha,
    });
  }

  // 新しいファイルをインラインで追加
  files.push({
    file: newFilePath,
    data: newFileContent,
    encoding: "utf-8",
  });

  return files;
}

/**
 * インラインファイルでデプロイを作成（既存ファイルをマージ）
 */
function createDeploymentWithMergedFiles(
  token: string,
  projectName: string,
  files: VercelFileEntry[],
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
          files,
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
 * Vercel にデプロイする
 */
export function deployToVercel(
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

  return getOrCreatePasteHostProject(token).andThen((project) =>
    // 既存ファイル一覧を取得
    getLatestDeploymentFiles(token, project.id).andThen((existingFiles) => {
      // 既存ファイルと新しいファイルをマージ
      const files = mergeFilesForDeployment(
        existingFiles,
        filePath,
        processed.content,
      );

      onProgress?.("Creating deployment...");

      return createDeploymentWithMergedFiles(token, project.name, files).map(
        (deployment) => ({
          projectId: project.id,
          projectName: project.name,
          deployUrl: `https://${deployment.url}/${filePath}`,
        }),
      );
    }),
  );
}
