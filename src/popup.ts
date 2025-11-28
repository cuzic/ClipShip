/**
 * Popup メインロジック
 * デフォルトプロバイダーへの1クリックデプロイ
 */

import { ResultAsync, errAsync, okAsync } from "neverthrow";
import { deployToCloudflare } from "./lib/cloudflare";
import { type ContentType, detectContentType } from "./lib/detect";
import type { DeployError } from "./lib/errors";
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
 * クリップボードエラー
 */
class ClipboardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClipboardError";
  }
}

/**
 * 認証エラー
 */
class CredentialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredentialError";
  }
}

type PopupError = DeployError | ClipboardError | CredentialError;

/**
 * クリップボードからテキストを取得
 */
function getClipboardText(): ResultAsync<string, ClipboardError> {
  return okAsync(undefined)
    .andThen(() =>
      ResultAsync.fromPromise(
        navigator.clipboard.readText(),
        () => new ClipboardError("Failed to read clipboard"),
      ),
    )
    .andThen((text) =>
      text
        ? okAsync(text)
        : errAsync(new ClipboardError("Clipboard is empty.")),
    );
}

/**
 * プロバイダーごとのデプロイ設定
 */
interface DeployConfig {
  getCredentials: () => ResultAsync<
    { token: string; accountId?: string },
    CredentialError
  >;
  deploy: (
    token: string,
    accountId: string | undefined,
    text: string,
    onProgress: (message: string) => void,
    theme: CssTheme,
  ) => ResultAsync<string, DeployError>;
}

/**
 * プロバイダーごとのデプロイ設定マップ
 */
const DEPLOY_CONFIGS: Record<DeployProvider, DeployConfig> = {
  netlify: {
    getCredentials: () =>
      ResultAsync.fromSafePromise(
        Promise.all([
          getStorageData("netlifyOAuthToken"),
          getStorageData("netlifyToken"),
        ]),
      ).andThen(([oauthToken, manualToken]) => {
        const token = oauthToken || manualToken;
        return token
          ? okAsync({ token })
          : errAsync(new CredentialError("Netlify Token not set in Options."));
      }),
    deploy: (token, _accountId, text, onProgress, theme) =>
      deployToNetlify(token, text, onProgress, theme).map((r) => r.deployUrl),
  },
  vercel: {
    getCredentials: () =>
      ResultAsync.fromSafePromise(getStorageData("vercelToken")).andThen(
        (token) =>
          token
            ? okAsync({ token })
            : errAsync(new CredentialError("Vercel Token not set in Options.")),
      ),
    deploy: (token, _accountId, text, onProgress, theme) =>
      deployToVercel(token, text, onProgress, theme).map((r) => r.deployUrl),
  },
  cloudflare: {
    getCredentials: () =>
      ResultAsync.fromSafePromise(
        Promise.all([
          getStorageData("cloudflareToken"),
          getStorageData("cloudflareAccountId"),
        ]),
      ).andThen(([token, accountId]) => {
        if (!token)
          return errAsync(
            new CredentialError("Cloudflare Token not set in Options."),
          );
        if (!accountId)
          return errAsync(
            new CredentialError("Cloudflare Account ID not set in Options."),
          );
        return okAsync({ token, accountId });
      }),
    deploy: (token, accountId, text, onProgress, theme) =>
      deployToCloudflare(
        token,
        accountId as string,
        text,
        onProgress,
        theme,
      ).map((r) => r.deployUrl),
  },
  gist: {
    getCredentials: () =>
      ResultAsync.fromSafePromise(
        Promise.all([
          getStorageData("githubOAuthToken"),
          getStorageData("githubToken"),
        ]),
      ).andThen(([oauthToken, manualToken]) => {
        const token = oauthToken || manualToken;
        return token
          ? okAsync({ token })
          : errAsync(new CredentialError("GitHub Token not set in Options."));
      }),
    deploy: (token, _accountId, text, onProgress, theme) => {
      onProgress("Creating Gist...");
      return deployToGist(token, text, theme).map((r) => r.deployUrl);
    },
  },
};

/**
 * 汎用デプロイ処理
 */
function handleProviderDeploy(
  statusDiv: HTMLDivElement,
  provider: DeployProvider,
  theme: CssTheme,
): ResultAsync<DeployResult, PopupError> {
  const config = DEPLOY_CONFIGS[provider];

  return config.getCredentials().andThen(({ token, accountId }) =>
    getClipboardText().andThen((text) => {
      const contentInfo = detectContentType(text);
      return config
        .deploy(
          token,
          accountId,
          text,
          (message) => showLoading(statusDiv, message),
          theme,
        )
        .map((url) => ({ url, content: text, contentType: contentInfo.type }));
    }),
  );
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

  const result = await handleProviderDeploy(statusDiv, provider, theme);

  await result.match(
    async (deployResult) => {
      // 履歴に保存
      const title = extractTitle(
        deployResult.content,
        deployResult.contentType,
      );
      await addDeployHistory({
        title,
        url: deployResult.url,
        provider,
        contentType: deployResult.contentType,
      });

      await showSuccess(statusDiv, deployResult.url);
    },
    async (error) => {
      showError(statusDiv, error.message);
    },
  );

  deployBtn.disabled = false;
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
