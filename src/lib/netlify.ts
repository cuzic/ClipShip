/**
 * Netlify API モジュール
 * File Digest API を使用してデプロイを行う
 */

import ky, { HTTPError } from "ky";
import { nanoid } from "nanoid";
import { type NetlifySite, NetlifySiteSchema } from "../schemas/netlify";
import { processContent } from "./html";
import { getStorageData, setStorageData } from "./storage";

const NETLIFY_API_URL = "https://api.netlify.com/api/v1/sites";
const NETLIFY_DEPLOYS_API_URL = "https://api.netlify.com/api/v1/deploys";
const POLL_INTERVAL_MS = 1000;
const MAX_POLL_ATTEMPTS = 60;
const CLIPSHIP_SITE_PREFIX = "clipship-";

/**
 * 文字列の SHA1 ハッシュを計算
 */
async function sha1(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
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
  required: z.array(z.string()).optional(),
});

type Deploy = z.infer<typeof DeploySchema>;

/**
 * ファイル情報の型
 */
interface FileInfo {
  path: string;
  content: string;
  hash: string;
}

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
 * デプロイの状態を取得
 */
async function getDeploy(token: string, deployId: string): Promise<Deploy> {
  const response = await ky
    .get(`${NETLIFY_DEPLOYS_API_URL}/${deployId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    .json();

  return DeploySchema.parse(response);
}

/**
 * デプロイが ready になるまでポーリング
 */
async function waitForDeployReady(
  token: string,
  deployId: string,
  onProgress?: (state: string) => void,
): Promise<Deploy> {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    const deploy = await getDeploy(token, deployId);

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
 * File Digest API でデプロイを作成
 */
async function createDigestDeploy(
  token: string,
  siteId: string,
  files: FileInfo[],
): Promise<Deploy> {
  // ファイルパスとハッシュのマッピングを作成
  const filesDigest: Record<string, string> = {};
  for (const file of files) {
    filesDigest[`/${file.path}`] = file.hash;
  }

  const response = await ky
    .post(`${NETLIFY_API_URL}/${siteId}/deploys`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      json: {
        files: filesDigest,
      },
    })
    .json();

  return DeploySchema.parse(response);
}

/**
 * 必要なファイルをアップロード
 */
async function uploadRequiredFiles(
  token: string,
  deployId: string,
  files: FileInfo[],
  requiredHashes: string[],
): Promise<void> {
  const requiredSet = new Set(requiredHashes);

  for (const file of files) {
    if (requiredSet.has(file.hash)) {
      await ky.put(
        `${NETLIFY_DEPLOYS_API_URL}/${deployId}/files/${file.path}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/octet-stream",
          },
          body: file.content,
        },
      );
    }
  }
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
 * - File Digest API を使用し、既存ファイルを保持しながら新規ファイルを追加
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

    // ファイル情報を準備
    const filePath = `${subdir}/${processed.filename}`;
    const fileHash = await sha1(processed.content);

    const files: FileInfo[] = [
      {
        path: filePath,
        content: processed.content,
        hash: fileHash,
      },
    ];

    if (onProgress) {
      onProgress("Creating deploy...");
    }

    // File Digest API でデプロイを作成
    const deploy = await createDigestDeploy(token, site.id, files);

    // 必要なファイルをアップロード
    if (deploy.required && deploy.required.length > 0) {
      if (onProgress) {
        onProgress("Uploading files...");
      }
      await uploadRequiredFiles(token, deploy.id, files, deploy.required);
    }

    if (onProgress) {
      onProgress("Processing...");
    }

    // デプロイが ready になるまでポーリング
    await waitForDeployReady(token, deploy.id, (state) => {
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
