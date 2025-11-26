/**
 * GitHub Gist API モジュール
 * Gist作成とGistHack URL変換を行う
 */

import ky, { HTTPError } from "ky";
import { type GistResponse, GistResponseSchema } from "../schemas/gist";
import { type ProcessedContent, processContent } from "./html";

const GITHUB_GIST_API_URL = "https://api.github.com/gists";

/**
 * GistHack URLに変換する
 * gist.githubusercontent.com → gist.githack.com
 */
export function convertToGistHackUrl(rawUrl: string): string {
  return rawUrl.replace("gist.githubusercontent.com", "gist.githack.com");
}

/**
 * GitHub Gistを作成する
 * @param token - GitHub Personal Access Token (gist scope)
 * @param processed - 処理済みコンテンツ
 * @param description - Gistの説明
 * @returns Gist作成結果
 */
async function createGist(
  token: string,
  processed: ProcessedContent,
  description = "Deployed via ClipShip",
): Promise<GistResponse> {
  try {
    const response = await ky
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
      .json();

    return GistResponseSchema.parse(response);
  } catch (error) {
    if (error instanceof HTTPError) {
      if (error.response.status === 401) {
        throw new Error("Authentication failed. Check your GitHub token.");
      }
      if (error.response.status === 403) {
        throw new Error("Permission denied. Check gist scope.");
      }
      if (error.response.status === 422) {
        throw new Error("Validation error. Check your request.");
      }
      const body = await error.response.json().catch(() => ({}));
      throw new Error(
        (body as { message?: string }).message || "GitHub API Error",
      );
    }
    throw error;
  }
}

/**
 * Gistにデプロイし、GistHack URLを取得する
 * @param token - GitHub Personal Access Token
 * @param content - クリップボードから取得したコンテンツ
 * @returns GistHack URL
 */
export async function deployToGist(
  token: string,
  content: string,
): Promise<string> {
  const processed = processContent(content);
  const gist = await createGist(token, processed);
  const file = gist.files[processed.filename];
  if (!file || !file.raw_url) {
    throw new Error("Failed to get raw_url from created gist");
  }
  return convertToGistHackUrl(file.raw_url);
}
