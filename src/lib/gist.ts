/**
 * GitHub Gist API モジュール
 * Gist作成とGistHack URL変換を行う
 */

import { type GistResponse, GistResponseSchema } from "@/schemas/gist";
import ky, { HTTPError } from "ky";
import { ResultAsync } from "neverthrow";
import {
  ApiError,
  AuthenticationError,
  type DeployError,
  PermissionError,
  ValidationError,
} from "./errors";
import { type ProcessedContent, processContent } from "./html";
import type { CssTheme } from "./storage";

const GITHUB_GIST_API_URL = "https://api.github.com/gists";

/**
 * GistHack URLに変換する
 * gist.githubusercontent.com → gist.githack.com
 */
export function convertToGistHackUrl(rawUrl: string): string {
  return rawUrl.replace("gist.githubusercontent.com", "gist.githack.com");
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
 * GitHub Gistを作成する (Result版)
 */
function createGist(
  token: string,
  processed: ProcessedContent,
  description = "Deployed via ClipShip",
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
            [processed.filename]: {
              content: processed.content,
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
 * Gistにデプロイし、GistHack URLを取得する (Result版)
 */
export function deployToGistResult(
  token: string,
  content: string,
  theme: CssTheme = "default",
): ResultAsync<GistDeployResult, DeployError> {
  const processed = processContent(content, theme);

  return createGist(token, processed).andThen((gist) => {
    const file = gist.files[processed.filename];
    if (!file || !file.raw_url) {
      return ResultAsync.fromPromise(
        Promise.reject(ValidationError.invalidResponse("Missing raw_url")),
        () => ValidationError.invalidResponse("Missing raw_url"),
      );
    }

    return ResultAsync.fromSafePromise(
      Promise.resolve({
        gistId: gist.id,
        gistUrl: gist.html_url,
        deployUrl: convertToGistHackUrl(file.raw_url),
      }),
    );
  });
}

/**
 * Gistにデプロイし、GistHack URLを取得する (後方互換性のため維持)
 * @deprecated deployToGistResult を使用してください
 */
export async function deployToGist(
  token: string,
  content: string,
  theme: CssTheme = "default",
): Promise<string> {
  const result = await deployToGistResult(token, content, theme);

  if (result.isErr()) {
    throw result.error;
  }

  return result.value.deployUrl;
}
