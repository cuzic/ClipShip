/**
 * Netlify API モジュール
 * File Digest API を使用してデプロイを行う
 */

import { type NetlifySite, NetlifySiteSchema } from "@/schemas/netlify";
import ky, { HTTPError } from "ky";
import { nanoid } from "nanoid";
import { ResultAsync, err, ok } from "neverthrow";
import { z } from "zod";
import { ApiError, AuthenticationError, type DeployError } from "./errors";
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
 * デプロイ結果の型
 */
interface NetlifyDeployResult {
  siteId: string;
  siteName: string;
  deployUrl: string;
}

/**
 * HTTPError を DeployError に変換
 */
function mapHttpError(error: HTTPError): DeployError {
  if (error.response.status === 401) {
    return AuthenticationError.invalidToken("Netlify");
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
 * 全サイトを取得
 */
function listSites(token: string): ResultAsync<NetlifySite[], DeployError> {
  return ResultAsync.fromPromise(
    ky
      .get(NETLIFY_API_URL, {
        headers: { Authorization: `Bearer ${token}` },
        searchParams: { filter: "all" },
      })
      .json()
      .then((response) => z.array(NetlifySiteSchema).parse(response)),
    mapUnknownError,
  );
}

/**
 * ClipShip 用のサイトを検索
 */
function findClipShipSite(
  token: string,
): ResultAsync<NetlifySite | null, DeployError> {
  return listSites(token).map((sites) => {
    const clipshipSite = sites.find((site) =>
      site.name.startsWith(CLIPSHIP_SITE_PREFIX),
    );
    return clipshipSite ?? null;
  });
}

/**
 * サイト情報を取得
 */
function getSite(
  token: string,
  siteId: string,
): ResultAsync<NetlifySite, DeployError> {
  return ResultAsync.fromPromise(
    ky
      .get(`${NETLIFY_API_URL}/${siteId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .json()
      .then((response) => NetlifySiteSchema.parse(response)),
    mapUnknownError,
  );
}

/**
 * 新規 ClipShip サイトを作成
 */
function createClipShipSite(
  token: string,
): ResultAsync<NetlifySite, DeployError> {
  const siteName = `${CLIPSHIP_SITE_PREFIX}${nanoid()}`;

  return ResultAsync.fromPromise(
    ky
      .post(NETLIFY_API_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        json: { name: siteName },
      })
      .json()
      .then((response) => NetlifySiteSchema.parse(response)),
    mapUnknownError,
  );
}

/**
 * ClipShip サイトを取得または作成
 */
async function getOrCreateClipShipSite(
  token: string,
): Promise<ResultAsync<NetlifySite, DeployError>> {
  // 1. storage から取得
  const storedSiteId = await getStorageData("netlifySiteId");
  if (storedSiteId) {
    const siteResult = await getSite(token, storedSiteId);
    if (siteResult.isOk()) {
      return ResultAsync.fromSafePromise(Promise.resolve(siteResult.value));
    }
    // サイトが削除されている可能性があるので続行
  }

  // 2. 既存の clipship-* サイトを検索
  const existingSiteResult = await findClipShipSite(token);
  if (existingSiteResult.isOk() && existingSiteResult.value) {
    await setStorageData("netlifySiteId", existingSiteResult.value.id);
    return ResultAsync.fromSafePromise(
      Promise.resolve(existingSiteResult.value),
    );
  }

  // 3. 新規作成
  return createClipShipSite(token).map(async (site) => {
    await setStorageData("netlifySiteId", site.id);
    return site;
  });
}

/**
 * デプロイの状態を取得
 */
function getDeploy(
  token: string,
  deployId: string,
): ResultAsync<Deploy, DeployError> {
  return ResultAsync.fromPromise(
    ky
      .get(`${NETLIFY_DEPLOYS_API_URL}/${deployId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .json()
      .then((response) => DeploySchema.parse(response)),
    mapUnknownError,
  );
}

/**
 * デプロイが ready になるまでポーリング
 */
async function waitForDeployReady(
  token: string,
  deployId: string,
  onProgress?: (state: string) => void,
): Promise<ResultAsync<Deploy, DeployError>> {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    const deployResult = await getDeploy(token, deployId);

    if (deployResult.isErr()) {
      return ResultAsync.fromSafePromise(
        Promise.resolve(deployResult as unknown as Deploy),
      ).mapErr(() => deployResult.error);
    }

    const deploy = deployResult.value;

    if (onProgress) {
      onProgress(deploy.state);
    }

    if (deploy.state === "ready") {
      return ResultAsync.fromSafePromise(Promise.resolve(deploy));
    }

    if (deploy.state === "error") {
      return ResultAsync.fromPromise(
        Promise.reject(ApiError.deployFailed()),
        () => ApiError.deployFailed(),
      );
    }

    await sleep(POLL_INTERVAL_MS);
  }

  return ResultAsync.fromPromise(Promise.reject(ApiError.deployTimeout()), () =>
    ApiError.deployTimeout(),
  );
}

/**
 * File Digest API でデプロイを作成
 */
function createDigestDeploy(
  token: string,
  siteId: string,
  files: FileInfo[],
): ResultAsync<Deploy, DeployError> {
  const filesDigest: Record<string, string> = {};
  for (const file of files) {
    filesDigest[`/${file.path}`] = file.hash;
  }

  return ResultAsync.fromPromise(
    ky
      .post(`${NETLIFY_API_URL}/${siteId}/deploys`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        json: { files: filesDigest },
      })
      .json()
      .then((response) => DeploySchema.parse(response)),
    mapUnknownError,
  );
}

/**
 * 必要なファイルをアップロード
 */
function uploadRequiredFiles(
  token: string,
  deployId: string,
  files: FileInfo[],
  requiredHashes: string[],
): ResultAsync<void, DeployError> {
  const requiredSet = new Set(requiredHashes);

  const uploadPromises = files
    .filter((file) => requiredSet.has(file.hash))
    .map((file) =>
      ky.put(`${NETLIFY_DEPLOYS_API_URL}/${deployId}/files/${file.path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
        },
        body: file.content,
      }),
    );

  return ResultAsync.fromPromise(
    Promise.all(uploadPromises).then(() => undefined),
    mapUnknownError,
  );
}

/**
 * Netlifyにデプロイする (Result版)
 */
export async function deployToNetlifyResult(
  token: string,
  content: string,
  onProgress?: (message: string) => void,
): Promise<ResultAsync<NetlifyDeployResult, DeployError>> {
  if (onProgress) {
    onProgress("Preparing site...");
  }

  // サイトを取得または作成
  const siteResultAsync = await getOrCreateClipShipSite(token);
  const siteResult = await siteResultAsync;

  if (siteResult.isErr()) {
    return ResultAsync.fromPromise(
      Promise.reject(siteResult.error),
      () => siteResult.error,
    );
  }

  const site = siteResult.value;

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
  const deployResult = await createDigestDeploy(token, site.id, files);

  if (deployResult.isErr()) {
    return ResultAsync.fromPromise(
      Promise.reject(deployResult.error),
      () => deployResult.error,
    );
  }

  const deploy = deployResult.value;

  // 必要なファイルをアップロード
  if (deploy.required && deploy.required.length > 0) {
    if (onProgress) {
      onProgress("Uploading files...");
    }
    const uploadResult = await uploadRequiredFiles(
      token,
      deploy.id,
      files,
      deploy.required,
    );
    if (uploadResult.isErr()) {
      return ResultAsync.fromPromise(
        Promise.reject(uploadResult.error),
        () => uploadResult.error,
      );
    }
  }

  if (onProgress) {
    onProgress("Processing...");
  }

  // デプロイが ready になるまでポーリング
  const readyResultAsync = await waitForDeployReady(
    token,
    deploy.id,
    (state) => {
      if (onProgress) {
        onProgress(`Processing (${state})...`);
      }
    },
  );

  const readyResult = await readyResultAsync;

  if (readyResult.isErr()) {
    return ResultAsync.fromPromise(
      Promise.reject(readyResult.error),
      () => readyResult.error,
    );
  }

  // 最終 URL を構築
  const baseUrl = site.ssl_url ?? site.url;
  const deployUrl = `${baseUrl}/${subdir}/${processed.filename}`;

  return ResultAsync.fromSafePromise(
    Promise.resolve({
      siteId: site.id,
      siteName: site.name,
      deployUrl,
    }),
  );
}

/**
 * Netlifyにデプロイする (後方互換性のため維持)
 * @deprecated deployToNetlifyResult を使用してください
 */
export async function deployToNetlify(
  token: string,
  content: string,
  onProgress?: (message: string) => void,
): Promise<NetlifyDeployResult> {
  const resultAsync = await deployToNetlifyResult(token, content, onProgress);
  const result = await resultAsync;

  if (result.isErr()) {
    throw result.error;
  }

  return result.value;
}
