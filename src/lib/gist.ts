/**
 * GitHub Gist API モジュール
 * 1つの Gist に複数ファイルを追加する方式で管理
 */

import { type GistResponse, GistResponseSchema } from "@/schemas/gist";
import ky, { HTTPError } from "ky";
import { nanoid } from "nanoid";
import { ResultAsync, errAsync, okAsync } from "neverthrow";
import {
  ApiError,
  AuthenticationError,
  type DeployError,
  PermissionError,
  ValidationError,
} from "./errors";
import { type ProcessedContent, processContent } from "./html";
import { type CssTheme, getStorageData, setStorageData } from "./storage";

const GITHUB_GIST_API_URL = "https://api.github.com/gists";

/**
 * 1つの Gist に保持する最大ファイル数
 * これを超えると新しい Gist を作成する
 */
const MAX_FILES_PER_GIST = 290;

/**
 * raw_url から commit hash を除去して最新版 URL にする
 * 例: .../raw/abc123def/file.html → .../raw/file.html
 */
function removeCommitHash(rawUrl: string): string {
  return rawUrl.replace(/\/raw\/[a-f0-9]+\//, "/raw/");
}

/**
 * GistHack URLに変換する
 * gist.githubusercontent.com → gist.githack.com
 * commit hash も除去して最新版を参照
 */
export function convertToGistHackUrl(rawUrl: string): string {
  const latestUrl = removeCommitHash(rawUrl);
  return latestUrl.replace("gist.githubusercontent.com", "gist.githack.com");
}

/**
 * ユニークなファイル名を生成
 * 形式: page-{timestamp}-{shortId}.html
 */
function generateUniqueFilename(): string {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `page-${date}-${nanoid(4)}.html`;
}

/**
 * HTTPError を DeployError に変換
 */
function mapHttpError(error: HTTPError): DeployError {
  if (error.response.status === 401) {
    return AuthenticationError.invalidToken("GitHub");
  }
  if (error.response.status === 403) {
    return PermissionError.insufficientScope("gist");
  }
  if (error.response.status === 404) {
    return new ApiError("Gist not found");
  }
  if (error.response.status === 422) {
    return ValidationError.invalidRequest();
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
 * Gist デプロイ結果の型
 */
interface GistDeployResult {
  gistId: string;
  gistUrl: string;
  deployUrl: string;
}

/**
 * Gist ファイル情報の型（一覧表示用）
 */
export interface GistFileInfo {
  filename: string;
  size: number;
  rawUrl: string;
  previewUrl: string;
}

/**
 * 既存の Gist を取得
 */
function getGist(
  token: string,
  gistId: string,
): ResultAsync<GistResponse, DeployError> {
  return ResultAsync.fromPromise(
    ky
      .get(`${GITHUB_GIST_API_URL}/${gistId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      })
      .json()
      .then((response) => GistResponseSchema.parse(response)),
    mapUnknownError,
  );
}

/**
 * 既存の Gist にファイルを追加 (PATCH)
 */
function addFileToGist(
  token: string,
  gistId: string,
  filename: string,
  content: string,
): ResultAsync<GistResponse, DeployError> {
  return ResultAsync.fromPromise(
    ky
      .patch(`${GITHUB_GIST_API_URL}/${gistId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        json: {
          files: {
            [filename]: {
              content,
            },
          },
        },
      })
      .json()
      .then((response) => GistResponseSchema.parse(response)),
    mapUnknownError,
  );
}

/**
 * 新しい Gist を作成
 */
function createGist(
  token: string,
  filename: string,
  content: string,
  description = "PasteHost Pages",
): ResultAsync<GistResponse, DeployError> {
  return ResultAsync.fromPromise(
    ky
      .post(GITHUB_GIST_API_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        json: {
          description,
          public: true, // GistHack を使うため public 必須
          files: {
            [filename]: {
              content,
            },
          },
        },
      })
      .json()
      .then((response) => GistResponseSchema.parse(response)),
    mapUnknownError,
  );
}

/**
 * Gist のファイル数をカウント
 */
function countGistFiles(gist: GistResponse): number {
  return Object.keys(gist.files).length;
}

/**
 * 保存された Gist ID を取得
 */
function getSavedGistId(): ResultAsync<string | undefined, DeployError> {
  return ResultAsync.fromPromise(
    getStorageData("gistId"),
    () => new ApiError("Failed to get saved gist ID"),
  );
}

/**
 * Gist ID を保存
 */
function saveGistId(gistId: string): ResultAsync<void, DeployError> {
  return ResultAsync.fromPromise(
    setStorageData("gistId", gistId),
    () => new ApiError("Failed to save gist ID"),
  );
}

/**
 * Gist にデプロイ
 * - 既存の Gist があれば、そこにファイルを追加
 * - Gist が存在しない or 300ファイル超過の場合は新規作成
 */
export function deployToGist(
  token: string,
  content: string,
  theme: CssTheme = "default",
): ResultAsync<GistDeployResult, DeployError> {
  const processed = processContent(content, theme);
  const filename = generateUniqueFilename();

  return getSavedGistId().andThen((savedGistId) => {
    if (!savedGistId) {
      // 保存された Gist ID がない → 新規作成
      return createNewGistAndSave(token, filename, processed.content);
    }

    // 既存の Gist があるか確認
    return getGist(token, savedGistId)
      .andThen((gist) => {
        // Gist が存在する
        const fileCount = countGistFiles(gist);

        if (fileCount >= MAX_FILES_PER_GIST) {
          // ファイル数上限 → 新規作成
          return createNewGistAndSave(token, filename, processed.content);
        }

        // 既存 Gist にファイル追加
        return addFileToGist(
          token,
          savedGistId,
          filename,
          processed.content,
        ).andThen((updatedGist) => {
          const file = updatedGist.files[filename];
          if (!file || !file.raw_url) {
            return errAsync(ValidationError.invalidResponse("Missing raw_url"));
          }

          return okAsync({
            gistId: updatedGist.id,
            gistUrl: updatedGist.html_url,
            deployUrl: convertToGistHackUrl(file.raw_url),
          });
        });
      })
      .orElse((error) => {
        // Gist が見つからない（削除された等）→ 新規作成
        if (error.message === "Gist not found") {
          return createNewGistAndSave(token, filename, processed.content);
        }
        return errAsync(error);
      });
  });
}

/**
 * 新しい Gist を作成して ID を保存
 */
function createNewGistAndSave(
  token: string,
  filename: string,
  content: string,
): ResultAsync<GistDeployResult, DeployError> {
  return createGist(token, filename, content).andThen((gist) => {
    const file = gist.files[filename];
    const rawUrl = file?.raw_url;
    if (!rawUrl) {
      return errAsync(ValidationError.invalidResponse("Missing raw_url"));
    }

    // 新しい Gist ID を保存
    return saveGistId(gist.id).andThen(() =>
      okAsync({
        gistId: gist.id,
        gistUrl: gist.html_url,
        deployUrl: convertToGistHackUrl(rawUrl),
      }),
    );
  });
}

/**
 * Gist 内のファイル一覧を取得
 */
export function listGistFiles(
  token: string,
): ResultAsync<GistFileInfo[], DeployError> {
  return getSavedGistId().andThen((savedGistId) => {
    if (!savedGistId) {
      return okAsync([]);
    }

    return getGist(token, savedGistId)
      .map((gist) => {
        const files: GistFileInfo[] = Object.entries(gist.files)
          .filter(
            (entry): entry is [string, { raw_url: string; size?: number }] =>
              entry[1]?.raw_url !== undefined,
          )
          .map(([filename, file]) => ({
            filename,
            size: file.size ?? 0,
            rawUrl: file.raw_url,
            previewUrl: convertToGistHackUrl(file.raw_url),
          }))
          .sort((a, b) => b.filename.localeCompare(a.filename)); // 新しい順

        return files;
      })
      .orElse((error) => {
        if (error.message === "Gist not found") {
          return okAsync([]);
        }
        return errAsync(error);
      });
  });
}

/**
 * Gist からファイルを削除
 */
export function deleteFileFromGist(
  token: string,
  filename: string,
): ResultAsync<void, DeployError> {
  return getSavedGistId().andThen((savedGistId) => {
    if (!savedGistId) {
      return errAsync(new ApiError("No Gist configured"));
    }

    return ResultAsync.fromPromise(
      ky
        .patch(`${GITHUB_GIST_API_URL}/${savedGistId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
          json: {
            files: {
              [filename]: null,
            },
          },
        })
        .json()
        .then(() => undefined),
      mapUnknownError,
    );
  });
}

/**
 * Gist のファイルを更新（再アップロード）
 */
export function updateFileInGist(
  token: string,
  filename: string,
  content: string,
  theme: CssTheme = "default",
): ResultAsync<string, DeployError> {
  return getSavedGistId().andThen((savedGistId) => {
    if (!savedGistId) {
      return errAsync(new ApiError("No Gist configured"));
    }

    const processed = processContent(content, theme);

    return addFileToGist(
      token,
      savedGistId,
      filename,
      processed.content,
    ).andThen((updatedGist) => {
      const file = updatedGist.files[filename];
      if (!file || !file.raw_url) {
        return errAsync(ValidationError.invalidResponse("Missing raw_url"));
      }

      return okAsync(convertToGistHackUrl(file.raw_url));
    });
  });
}
