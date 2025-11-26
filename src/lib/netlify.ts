/**
 * Netlify API モジュール
 * ZIPデプロイを行う
 */

import { strToU8, zipSync } from "fflate";
import ky, { HTTPError } from "ky";
import { nanoid } from "nanoid";
import {
  type NetlifyDeployResponse,
  NetlifyDeployResponseSchema,
  type NetlifySite,
  NetlifySiteSchema,
} from "../schemas/netlify";
import { processContent } from "./html";
import { getStorageData, setStorageData } from "./storage";

const NETLIFY_API_URL = "https://api.netlify.com/api/v1/sites";
const POLL_INTERVAL_MS = 1000;
const MAX_POLL_ATTEMPTS = 60;
const CLIPSHIP_SITE_PREFIX = "clipship-";

/**
 * Netlify _headers ファイルを生成
 */
function createHeadersFile(path: string, mimeType: string): string {
  return `/${path}
  Content-Type: ${mimeType}; charset=UTF-8
`;
}

/**
 * コンテンツからZIPファイルを生成する（サブディレクトリ付き）
 */
function createZip(
  content: string,
  filename: string,
  mimeType: string,
  subdir: string,
): Uint8Array {
  const filePath = `${subdir}/${filename}`;
  const headersPath = `${subdir}/_headers`;
  return zipSync({
    [filePath]: strToU8(content),
    [headersPath]: strToU8(createHeadersFile(filename, mimeType)),
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
 * 全サイトを取得
 */
async function listSites(token: string): Promise<NetlifySite[]> {
  const response = await ky
    .get(NETLIFY_API_URL, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      searchParams: {
        filter: "all",
      },
    })
    .json();

  return z.array(NetlifySiteSchema).parse(response);
}

/**
 * ClipShip 用のサイトを検索
 */
async function findClipShipSite(token: string): Promise<NetlifySite | null> {
  const sites = await listSites(token);
  const clipshipSite = sites.find((site) =>
    site.name.startsWith(CLIPSHIP_SITE_PREFIX),
  );
  return clipshipSite ?? null;
}

/**
 * 新規 ClipShip サイトを作成
 */
async function createClipShipSite(token: string): Promise<NetlifySite> {
  const siteName = `${CLIPSHIP_SITE_PREFIX}${nanoid()}`;

  const response = await ky
    .post(NETLIFY_API_URL, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      json: {
        name: siteName,
      },
    })
    .json();

  return NetlifySiteSchema.parse(response);
}

/**
 * ClipShip サイトを取得または作成
 * 1. storage に site_id があればそれを使用
 * 2. なければ API で clipship-* サイトを検索
 * 3. なければ新規作成
 */
async function getOrCreateClipShipSite(token: string): Promise<NetlifySite> {
  // 1. storage から取得
  const storedSiteId = await getStorageData("netlifySiteId");
  if (storedSiteId) {
    try {
      const response = await ky
        .get(`${NETLIFY_API_URL}/${storedSiteId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        .json();
      return NetlifySiteSchema.parse(response);
    } catch {
      // サイトが削除されている可能性があるので続行
    }
  }

  // 2. 既存の clipship-* サイトを検索
  const existingSite = await findClipShipSite(token);
  if (existingSite) {
    await setStorageData("netlifySiteId", existingSite.id);
    return existingSite;
  }

  // 3. 新規作成
  const newSite = await createClipShipSite(token);
  await setStorageData("netlifySiteId", newSite.id);
  return newSite;
}

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
 * デプロイ結果の型
 */
export interface DeployResult {
  siteId: string;
  siteName: string;
  deployUrl: string;
}

/**
 * Netlifyにデプロイする
 * - 初回は clipship-{nanoid} サイトを作成
 * - 2回目以降は同じサイトに {nanoid}/index.html としてデプロイ
 * @param token - Netlify Personal Access Token
 * @param content - クリップボードから取得したコンテンツ
 * @param onProgress - 進捗コールバック
 * @returns デプロイ結果（公開URL含む）
 */
export async function deployToNetlify(
  token: string,
  content: string,
  onProgress?: (message: string) => void,
): Promise<DeployResult> {
  try {
    if (onProgress) {
      onProgress("Preparing site...");
    }

    // サイトを取得または作成
    const site = await getOrCreateClipShipSite(token);

    // ランダムなサブディレクトリ名を生成
    const subdir = nanoid();

    const processed = processContent(content);
    const zipData = createZip(
      processed.content,
      processed.filename,
      processed.mimeType,
      subdir,
    );
    const blob = new Blob([zipData], { type: "application/zip" });

    if (onProgress) {
      onProgress("Uploading...");
    }

    // 既存サイトにデプロイ
    const response = await ky
      .post(`${NETLIFY_API_URL}/${site.id}/deploys`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: blob,
      })
      .json();

    const deployResponse = NetlifyDeployResponseSchema.parse(response);

    if (onProgress) {
      onProgress("Processing...");
    }

    // デプロイが ready になるまでポーリング
    await waitForDeployReady(token, site.id, (state) => {
      if (onProgress) {
        onProgress(`Processing (${state})...`);
      }
    });

    // 最終 URL を構築
    const baseUrl = site.ssl_url ?? site.url;
    const deployUrl = `${baseUrl}/${subdir}/${processed.filename}`;

    return {
      siteId: site.id,
      siteName: site.name,
      deployUrl,
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
