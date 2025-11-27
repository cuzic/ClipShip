/**
 * Popup メインロジック
 * デフォルトプロバイダーへの1クリックデプロイ
 */

import { deployToCloudflare } from "./lib/cloudflare";
import { type ContentType, detectContentType } from "./lib/detect";
import { deployToGist } from "./lib/gist";
import { deployToNetlify } from "./lib/netlify";
import {
  type DeployProvider,
  addDeployHistory,
  getDefaultProvider,
  getStorageData,
} from "./lib/storage";
import { extractTitle } from "./lib/title";
import { deployToVercel } from "./lib/vercel";

/**
 * プロバイダー名の表示用マッピング
 */
const PROVIDER_NAMES: Record<DeployProvider, string> = {
  netlify: "Netlify",
  vercel: "Vercel",
  cloudflare: "Cloudflare Pages",
  gist: "GitHub Gist",
};

/**
 * DOM要素の取得
 */
function getElements() {
  const statusDiv = document.getElementById("status") as HTMLDivElement;
  const deployBtn = document.getElementById("btn-deploy") as HTMLButtonElement;
  const providerHint = document.getElementById(
    "provider-hint",
  ) as HTMLDivElement;
  return { statusDiv, deployBtn, providerHint };
}

/**
 * ボタンのスタイルをプロバイダーに合わせて設定
 */
function setButtonStyle(btn: HTMLButtonElement, provider: DeployProvider) {
  btn.className = provider;
  btn.textContent = `Deploy to ${PROVIDER_NAMES[provider]}`;
}

/**
 * ステータス表示: 成功 & 新しいタブで開く
 */
async function showSuccess(statusDiv: HTMLDivElement, url: string) {
  statusDiv.innerHTML = `<span class="success">Success!</span><br><a href="${url}" target="_blank">${url}</a>`;
  await navigator.clipboard.writeText(url);
  statusDiv.innerHTML += "<br><br>Copied to clipboard!";

  // 新しいタブで開く
  chrome.tabs.create({ url, active: true });
}

/**
 * ステータス表示: エラー
 */
function showError(statusDiv: HTMLDivElement, message: string) {
  console.error(message);
  statusDiv.innerHTML = `<span class="error">Error: ${message}</span>`;
}

/**
 * ステータス表示: ローディング
 */
function showLoading(statusDiv: HTMLDivElement, message: string) {
  statusDiv.innerHTML = `<span class="loading">${message}</span>`;
}

/**
 * デプロイ結果
 */
interface DeployResult {
  url: string;
  content: string;
  contentType: ContentType;
}

/**
 * クリップボードからテキストを取得
 */
async function getClipboardText(): Promise<string> {
  const text = await navigator.clipboard.readText();
  if (!text) {
    throw new Error("Clipboard is empty.");
  }
  return text;
}

/**
 * Netlify デプロイ処理
 */
async function handleNetlifyDeploy(
  statusDiv: HTMLDivElement,
): Promise<DeployResult> {
  const token = await getStorageData("netlifyToken");
  if (!token) {
    throw new Error("Netlify Token not set in Options.");
  }

  const text = await getClipboardText();
  const contentInfo = detectContentType(text);
  const result = await deployToNetlify(token, text, (message) => {
    showLoading(statusDiv, message);
  });
  return {
    url: result.deployUrl,
    content: text,
    contentType: contentInfo.type,
  };
}

/**
 * Vercel デプロイ処理
 */
async function handleVercelDeploy(
  statusDiv: HTMLDivElement,
): Promise<DeployResult> {
  const token = await getStorageData("vercelToken");
  if (!token) {
    throw new Error("Vercel Token not set in Options.");
  }

  const text = await getClipboardText();
  const contentInfo = detectContentType(text);
  const result = await deployToVercel(token, text, (message) => {
    showLoading(statusDiv, message);
  });
  return {
    url: result.deployUrl,
    content: text,
    contentType: contentInfo.type,
  };
}

/**
 * Cloudflare Pages デプロイ処理
 */
async function handleCloudflareDeploy(
  statusDiv: HTMLDivElement,
): Promise<DeployResult> {
  const token = await getStorageData("cloudflareToken");
  const accountId = await getStorageData("cloudflareAccountId");
  if (!token) {
    throw new Error("Cloudflare Token not set in Options.");
  }
  if (!accountId) {
    throw new Error("Cloudflare Account ID not set in Options.");
  }

  const text = await getClipboardText();
  const contentInfo = detectContentType(text);
  const result = await deployToCloudflare(token, accountId, text, (message) => {
    showLoading(statusDiv, message);
  });
  return {
    url: result.deployUrl,
    content: text,
    contentType: contentInfo.type,
  };
}

/**
 * GistHack デプロイ処理
 */
async function handleGistDeploy(
  statusDiv: HTMLDivElement,
): Promise<DeployResult> {
  const token = await getStorageData("githubToken");
  if (!token) {
    throw new Error("GitHub Token not set in Options.");
  }

  const text = await getClipboardText();
  const contentInfo = detectContentType(text);
  showLoading(statusDiv, "Creating Gist...");
  const url = await deployToGist(token, text);
  return { url, content: text, contentType: contentInfo.type };
}

/**
 * デプロイ処理
 */
async function handleDeploy(
  statusDiv: HTMLDivElement,
  deployBtn: HTMLButtonElement,
  provider: DeployProvider,
) {
  deployBtn.disabled = true;
  showLoading(statusDiv, `Deploying to ${PROVIDER_NAMES[provider]}...`);

  try {
    let result: DeployResult;

    switch (provider) {
      case "netlify":
        result = await handleNetlifyDeploy(statusDiv);
        break;
      case "vercel":
        result = await handleVercelDeploy(statusDiv);
        break;
      case "cloudflare":
        result = await handleCloudflareDeploy(statusDiv);
        break;
      case "gist":
        result = await handleGistDeploy(statusDiv);
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }

    // 履歴に保存
    const title = extractTitle(result.content, result.contentType);
    await addDeployHistory({
      title,
      url: result.url,
      provider,
      contentType: result.contentType,
    });

    await showSuccess(statusDiv, result.url);
  } catch (error) {
    showError(statusDiv, (error as Error).message);
  } finally {
    deployBtn.disabled = false;
  }
}

/**
 * 初期化
 */
document.addEventListener("DOMContentLoaded", async () => {
  const { statusDiv, deployBtn, providerHint } = getElements();

  // デフォルトプロバイダーを取得
  const provider = await getDefaultProvider();

  // ボタンのスタイルを設定
  setButtonStyle(deployBtn, provider);

  // プロバイダーのヒントを表示
  providerHint.textContent = `Default: ${PROVIDER_NAMES[provider]}`;

  // デプロイボタンのクリックイベント
  deployBtn.addEventListener("click", () => {
    handleDeploy(statusDiv, deployBtn, provider);
  });
});
