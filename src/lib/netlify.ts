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
import { processContent } from "./html";

const NETLIFY_API_URL = "https://api.netlify.com/api/v1/sites";
const POLL_INTERVAL_MS = 1000;
const MAX_POLL_ATTEMPTS = 60;

/**
 * Netlify _headers ファイルを生成
 */
function createHeadersFile(filename: string, mimeType: string): string {
  return `/${filename}
  Content-Type: ${mimeType}; charset=UTF-8
`;
}

/**
 * コンテンツからZIPファイルを生成する
 */
function createZip(
  content: string,
  filename: string,
  mimeType: string,
): Uint8Array {
  return zipSync({
    [filename]: strToU8(content),
    _headers: strToU8(createHeadersFile(filename, mimeType)),
  });
}

/**
 * 指定時間待機
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * デプロイスキーマ (deploy オブジェクト用)
 */
import { z } from "zod";
const DeploySchema = z.object({
  id: z.string(),
  state: z.string(),
  ssl_url: z.string().optional(),
  url: z.string().optional(),
});

type Deploy = z.infer<typeof DeploySchema>;

/**
 * 最新のデプロイ状態を取得
 */
async function getLatestDeploy(token: string, siteId: string): Promise<Deploy> {
  const response = await ky
    .get(`${NETLIFY_API_URL}/${siteId}/deploys?per_page=1`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    .json();

  const deploys = z.array(DeploySchema).parse(response);
  if (deploys.length === 0) {
    throw new Error("No deploys found");
  }
  return deploys[0];
}

/**
 * デプロイが ready になるまでポーリング
 */
async function waitForDeployReady(
  token: string,
  siteId: string,
  onProgress?: (state: string) => void,
): Promise<Deploy> {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    const deploy = await getLatestDeploy(token, siteId);

    if (onProgress) {
      onProgress(deploy.state);
    }

    if (deploy.state === "ready") {
      return deploy;
    }

    if (deploy.state === "error") {
      throw new Error("Deploy failed on Netlify");
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error("Deploy timed out");
}

/**
 * Netlifyにデプロイする
 * @param token - Netlify Personal Access Token
 * @param content - クリップボードから取得したコンテンツ
 * @param onProgress - 進捗コールバック
 * @returns デプロイ結果（公開URL含む）
 */
export async function deployToNetlify(
  token: string,
  content: string,
  onProgress?: (message: string) => void,
): Promise<NetlifyDeployResponse & { deployUrl: string }> {
  const processed = processContent(content);
  const zipData = createZip(
    processed.content,
    processed.filename,
    processed.mimeType,
  );
  const blob = new Blob([zipData], { type: "application/zip" });

  try {
    if (onProgress) {
      onProgress("Uploading...");
    }

    const response = await ky
      .post(NETLIFY_API_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: blob,
      })
      .json();

    const site = NetlifyDeployResponseSchema.parse(response);

    if (onProgress) {
      onProgress("Processing...");
    }

    // デプロイが ready になるまでポーリング
    const deploy = await waitForDeployReady(token, site.id, (state) => {
      if (onProgress) {
        onProgress(`Processing (${state})...`);
      }
    });

    return {
      ...site,
      deployUrl: deploy.ssl_url ?? deploy.url ?? site.ssl_url ?? site.url,
    };
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
