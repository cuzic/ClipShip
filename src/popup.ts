/**
 * Popup メインロジック
 * デフォルトプロバイダーへの1クリックデプロイ
 */

import { deployToCloudflare } from "./lib/cloudflare";
import { type ContentType, detectContentType } from "./lib/detect";
import { deployToGist } from "./lib/gist";
import { deployToNetlify } from "./lib/netlify";
import {
  type CssTheme,
  type DeployProvider,
  addDeployHistory,
  getCssTheme,
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
 * DOM要素の取得結果
 */
interface PopupElements {
  statusDiv: HTMLDivElement;
  deployBtn: HTMLButtonElement;
  providerHint: HTMLDivElement;
}

/**
 * DOM要素の取得（型安全）
 */
function getElements(): PopupElements | null {
  const statusDiv = document.getElementById("status");
  const deployBtn = document.getElementById("btn-deploy");
  const providerHint = document.getElementById("provider-hint");

  if (
    !(statusDiv instanceof HTMLDivElement) ||
    !(deployBtn instanceof HTMLButtonElement) ||
    !(providerHint instanceof HTMLDivElement)
  ) {
    console.error("Required DOM elements not found");
    return null;
  }

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
 * プロバイダーごとのデプロイ設定
 */
interface DeployConfig {
  getCredentials: () => Promise<{ token: string; accountId?: string }>;
  deploy: (
    token: string,
    accountId: string | undefined,
    text: string,
    onProgress: (message: string) => void,
    theme: CssTheme,
  ) => Promise<string>;
}

/**
 * プロバイダーごとのデプロイ設定マップ
 */
const DEPLOY_CONFIGS: Record<DeployProvider, DeployConfig> = {
  netlify: {
    getCredentials: async () => {
      const token = await getStorageData("netlifyToken");
      if (!token) throw new Error("Netlify Token not set in Options.");
      return { token };
    },
    deploy: async (token, _accountId, text, onProgress, theme) => {
      const result = await deployToNetlify(token, text, onProgress, theme);
      return result.deployUrl;
    },
  },
  vercel: {
    getCredentials: async () => {
      const token = await getStorageData("vercelToken");
      if (!token) throw new Error("Vercel Token not set in Options.");
      return { token };
    },
    deploy: async (token, _accountId, text, onProgress, theme) => {
      const result = await deployToVercel(token, text, onProgress, theme);
      return result.deployUrl;
    },
  },
  cloudflare: {
    getCredentials: async () => {
      const token = await getStorageData("cloudflareToken");
      const accountId = await getStorageData("cloudflareAccountId");
      if (!token) throw new Error("Cloudflare Token not set in Options.");
      if (!accountId)
        throw new Error("Cloudflare Account ID not set in Options.");
      return { token, accountId };
    },
    deploy: async (token, accountId, text, onProgress, theme) => {
      // accountId is guaranteed to be defined by getCredentials
      const result = await deployToCloudflare(
        token,
        accountId as string,
        text,
        onProgress,
        theme,
      );
      return result.deployUrl;
    },
  },
  gist: {
    getCredentials: async () => {
      const token = await getStorageData("githubToken");
      if (!token) throw new Error("GitHub Token not set in Options.");
      return { token };
    },
    deploy: async (token, _accountId, text, onProgress, theme) => {
      onProgress("Creating Gist...");
      return await deployToGist(token, text, theme);
    },
  },
};

/**
 * 汎用デプロイ処理
 */
async function handleProviderDeploy(
  statusDiv: HTMLDivElement,
  provider: DeployProvider,
  theme: CssTheme,
): Promise<DeployResult> {
  const config = DEPLOY_CONFIGS[provider];
  const { token, accountId } = await config.getCredentials();
  const text = await getClipboardText();
  const contentInfo = detectContentType(text);
  const url = await config.deploy(
    token,
    accountId,
    text,
    (message) => showLoading(statusDiv, message),
    theme,
  );
  return { url, content: text, contentType: contentInfo.type };
}

/**
 * デプロイ処理
 */
async function handleDeploy(
  statusDiv: HTMLDivElement,
  deployBtn: HTMLButtonElement,
  provider: DeployProvider,
  theme: CssTheme,
) {
  deployBtn.disabled = true;
  showLoading(statusDiv, `Deploying to ${PROVIDER_NAMES[provider]}...`);

  try {
    const result = await handleProviderDeploy(statusDiv, provider, theme);

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
  const elements = getElements();
  if (!elements) {
    return;
  }

  const { statusDiv, deployBtn, providerHint } = elements;

  // デフォルトプロバイダーとテーマを取得
  const provider = await getDefaultProvider();
  const theme = await getCssTheme();

  // ボタンのスタイルを設定
  setButtonStyle(deployBtn, provider);

  // プロバイダーのヒントを表示
  providerHint.textContent = `Default: ${PROVIDER_NAMES[provider]}`;

  // デプロイボタンのクリックイベント
  deployBtn.addEventListener("click", () => {
    handleDeploy(statusDiv, deployBtn, provider, theme);
  });
});
