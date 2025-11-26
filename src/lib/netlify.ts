/**
 * Netlify API モジュール
 * ZIPデプロイを行う
 */

import { strToU8, zipSync } from "fflate";
import ky, { HTTPError } from "ky";
import {
  type NetlifyDeployResponse,
  NetlifyDeployResponseSchema,
} from "../schemas/netlify";
import { createHtml } from "./html";

const NETLIFY_API_URL = "https://api.netlify.com/api/v1/sites";

/**
 * HTML文字列からZIPファイルを生成する
 */
function createZip(html: string): Uint8Array {
  return zipSync({
    "index.html": strToU8(html),
  });
}

/**
 * Netlifyにデプロイする
 * @param token - Netlify Personal Access Token
 * @param content - クリップボードから取得したHTMLコンテンツ
 * @returns デプロイ結果（公開URL含む）
 */
export async function deployToNetlify(
  token: string,
  content: string,
): Promise<NetlifyDeployResponse> {
  const html = createHtml(content);
  const zipData = createZip(html);
  const blob = new Blob([zipData], { type: "application/zip" });

  try {
    const response = await ky
      .post(NETLIFY_API_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: blob,
      })
      .json();

    return NetlifyDeployResponseSchema.parse(response);
  } catch (error) {
    if (error instanceof HTTPError) {
      if (error.response.status === 401) {
        throw new Error("Authentication failed. Check your Netlify token.");
      }
      const body = await error.response.json().catch(() => ({}));
      throw new Error(
        (body as { message?: string }).message || "Netlify API Error",
      );
    }
    throw error;
  }
}
