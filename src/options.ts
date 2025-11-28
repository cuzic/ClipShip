/**
 * Options ページロジック
 * トークンの保存・読み込み、デフォルトプロバイダーの設定
 */

import {
  clearGitHubOAuthToken,
  getGitHubOAuthToken,
  getGitHubUser,
  startGitHubOAuth,
} from "./lib/github-oauth";
import {
  clearNetlifyOAuthToken,
  getNetlifyOAuthToken,
  getNetlifyUser,
  startNetlifyOAuth,
} from "./lib/netlify-oauth";
import {
  type CssTheme,
  type DeployProvider,
  getCssTheme,
  getDefaultProvider,
  getMultipleStorageData,
  getStorageData,
  setMultipleStorageData,
} from "./lib/storage";

/**
 * DOM要素の取得結果
 */
interface OptionsElements {
  netlifyTokenInput: HTMLInputElement;
  netlifyOAuthBtn: HTMLButtonElement;
  netlifyLogoutBtn: HTMLButtonElement;
  netlifyOAuthStatus: HTMLDivElement;
  vercelTokenInput: HTMLInputElement;
  cloudflareAccountIdInput: HTMLInputElement;
  cloudflareTokenInput: HTMLInputElement;
  githubTokenInput: HTMLInputElement;
  githubOAuthBtn: HTMLButtonElement;
  githubLogoutBtn: HTMLButtonElement;
  githubOAuthStatus: HTMLDivElement;
  saveButton: HTMLButtonElement;
  messageSpan: HTMLSpanElement;
  providerRadios: NodeListOf<HTMLInputElement>;
  providerRadioItems: NodeListOf<HTMLLabelElement>;
  themeRadios: NodeListOf<HTMLInputElement>;
  themeRadioItems: NodeListOf<HTMLLabelElement>;
}

/**
 * DOM要素の取得（型安全）
 */
function getElements(): OptionsElements | null {
  const netlifyTokenInput = document.getElementById("netlifyToken");
  const netlifyOAuthBtn = document.getElementById("netlifyOAuthBtn");
  const netlifyLogoutBtn = document.getElementById("netlifyLogoutBtn");
  const netlifyOAuthStatus = document.getElementById("netlifyOAuthStatus");
  const vercelTokenInput = document.getElementById("vercelToken");
  const cloudflareAccountIdInput = document.getElementById(
    "cloudflareAccountId",
  );
  const cloudflareTokenInput = document.getElementById("cloudflareToken");
  const githubTokenInput = document.getElementById("githubToken");
  const githubOAuthBtn = document.getElementById("githubOAuthBtn");
  const githubLogoutBtn = document.getElementById("githubLogoutBtn");
  const githubOAuthStatus = document.getElementById("githubOAuthStatus");
  const saveButton = document.getElementById("save");
  const messageSpan = document.getElementById("message");
  const providerRadios = document.querySelectorAll<HTMLInputElement>(
    'input[name="defaultProvider"]',
  );
  const providerRadioItems =
    document.querySelectorAll<HTMLLabelElement>("[data-provider]");
  const themeRadios = document.querySelectorAll<HTMLInputElement>(
    'input[name="cssTheme"]',
  );
  const themeRadioItems =
    document.querySelectorAll<HTMLLabelElement>("[data-theme]");

  if (
    !(netlifyTokenInput instanceof HTMLInputElement) ||
    !(netlifyOAuthBtn instanceof HTMLButtonElement) ||
    !(netlifyLogoutBtn instanceof HTMLButtonElement) ||
    !(netlifyOAuthStatus instanceof HTMLDivElement) ||
    !(vercelTokenInput instanceof HTMLInputElement) ||
    !(cloudflareAccountIdInput instanceof HTMLInputElement) ||
    !(cloudflareTokenInput instanceof HTMLInputElement) ||
    !(githubTokenInput instanceof HTMLInputElement) ||
    !(githubOAuthBtn instanceof HTMLButtonElement) ||
    !(githubLogoutBtn instanceof HTMLButtonElement) ||
    !(githubOAuthStatus instanceof HTMLDivElement) ||
    !(saveButton instanceof HTMLButtonElement) ||
    !(messageSpan instanceof HTMLSpanElement)
  ) {
    console.error("Required DOM elements not found");
    return null;
  }

  return {
    netlifyTokenInput,
    netlifyOAuthBtn,
    netlifyLogoutBtn,
    netlifyOAuthStatus,
    vercelTokenInput,
    cloudflareAccountIdInput,
    cloudflareTokenInput,
    githubTokenInput,
    githubOAuthBtn,
    githubLogoutBtn,
    githubOAuthStatus,
    saveButton,
    messageSpan,
    providerRadios,
    providerRadioItems,
    themeRadios,
    themeRadioItems,
  };
}

/**
 * 選択されたラジオボタンのスタイルを更新
 */
function updateSelectedStyles(
  radioItems: NodeListOf<HTMLLabelElement>,
  selectedValue: string,
  dataAttribute: "provider" | "theme",
) {
  for (const item of radioItems) {
    if (item.dataset[dataAttribute] === selectedValue) {
      item.classList.add("selected");
    } else {
      item.classList.remove("selected");
    }
  }
}

/**
 * メッセージを表示
 */
function showMessage(
  messageSpan: HTMLSpanElement,
  text: string,
  type: "success" | "error" = "success",
) {
  messageSpan.textContent = text;
  messageSpan.style.color = type === "error" ? "#dc3545" : "#28a745";
  setTimeout(() => {
    messageSpan.textContent = "";
  }, 3000);
}

/**
 * トークンの基本バリデーション
 * - 空でないか
 * - 明らかに無効な文字がないか
 */
function isValidToken(token: string): boolean {
  if (!token.trim()) {
    return true; // 空は許可（未設定状態）
  }
  // 空白や改行を含まない
  if (/\s/.test(token)) {
    return false;
  }
  // 最低限の長さ（トークンは通常10文字以上）
  if (token.length < 10) {
    return false;
  }
  return true;
}

/**
 * Cloudflare Account ID のバリデーション
 * - 32文字の16進数
 */
function isValidCloudflareAccountId(id: string): boolean {
  if (!id.trim()) {
    return true; // 空は許可
  }
  return /^[a-f0-9]{32}$/i.test(id);
}

/**
 * 設定のバリデーション
 */
async function validateSettings(
  netlifyToken: string,
  vercelToken: string,
  cloudflareAccountId: string,
  cloudflareToken: string,
  githubToken: string,
  defaultProvider: DeployProvider,
): Promise<string | null> {
  // トークンのバリデーション
  if (!isValidToken(netlifyToken)) {
    return "Invalid Netlify token format";
  }
  if (!isValidToken(vercelToken)) {
    return "Invalid Vercel token format";
  }
  if (!isValidToken(cloudflareToken)) {
    return "Invalid Cloudflare token format";
  }
  if (!isValidToken(githubToken)) {
    return "Invalid GitHub token format";
  }
  if (!isValidCloudflareAccountId(cloudflareAccountId)) {
    return "Invalid Cloudflare Account ID (should be 32 hex characters)";
  }

  // OAuth トークンも確認
  const netlifyOAuthToken = await getStorageData("netlifyOAuthToken");
  const hasNetlifyAuth = !!(netlifyToken.trim() || netlifyOAuthToken);
  const githubOAuthToken = await getStorageData("githubOAuthToken");
  const hasGitHubAuth = !!(githubToken.trim() || githubOAuthToken);

  // デフォルトプロバイダーに対応するトークンが設定されているか
  const tokenMap: Record<DeployProvider, boolean> = {
    netlify: hasNetlifyAuth,
    vercel: !!vercelToken.trim(),
    cloudflare: !!cloudflareToken.trim(),
    gist: hasGitHubAuth,
  };

  if (!tokenMap[defaultProvider]) {
    return `Please set a token for ${defaultProvider} (your default provider)`;
  }

  // Cloudflare の場合は Account ID も必要
  if (defaultProvider === "cloudflare" && !cloudflareAccountId.trim()) {
    return "Please set Cloudflare Account ID";
  }

  return null;
}

/**
 * 設定を保存
 */
async function saveSettings(
  netlifyToken: string,
  vercelToken: string,
  cloudflareAccountId: string,
  cloudflareToken: string,
  githubToken: string,
  defaultProvider: DeployProvider,
  cssTheme: CssTheme,
  messageSpan: HTMLSpanElement,
) {
  // バリデーション
  const error = await validateSettings(
    netlifyToken,
    vercelToken,
    cloudflareAccountId,
    cloudflareToken,
    githubToken,
    defaultProvider,
  );

  if (error) {
    showMessage(messageSpan, error, "error");
    return;
  }

  await setMultipleStorageData({
    netlifyToken,
    vercelToken,
    cloudflareAccountId,
    cloudflareToken,
    githubToken,
    defaultProvider,
    cssTheme,
  });
  showMessage(messageSpan, "Saved!", "success");
}

/**
 * 保存済み設定を読み込み
 */
async function loadSettings(
  netlifyTokenInput: HTMLInputElement,
  vercelTokenInput: HTMLInputElement,
  cloudflareAccountIdInput: HTMLInputElement,
  cloudflareTokenInput: HTMLInputElement,
  githubTokenInput: HTMLInputElement,
  providerRadios: NodeListOf<HTMLInputElement>,
  providerRadioItems: NodeListOf<HTMLLabelElement>,
  themeRadios: NodeListOf<HTMLInputElement>,
  themeRadioItems: NodeListOf<HTMLLabelElement>,
) {
  const data = await getMultipleStorageData([
    "netlifyToken",
    "vercelToken",
    "cloudflareAccountId",
    "cloudflareToken",
    "githubToken",
  ]);

  if (data.netlifyToken) {
    netlifyTokenInput.value = data.netlifyToken;
  }
  if (data.vercelToken) {
    vercelTokenInput.value = data.vercelToken;
  }
  if (data.cloudflareAccountId) {
    cloudflareAccountIdInput.value = data.cloudflareAccountId;
  }
  if (data.cloudflareToken) {
    cloudflareTokenInput.value = data.cloudflareToken;
  }
  if (data.githubToken) {
    githubTokenInput.value = data.githubToken;
  }

  // デフォルトプロバイダーを読み込み
  const defaultProvider = await getDefaultProvider();
  for (const radio of providerRadios) {
    if (radio.value === defaultProvider) {
      radio.checked = true;
    }
  }
  updateSelectedStyles(providerRadioItems, defaultProvider, "provider");

  // CSS テーマを読み込み
  const cssTheme = await getCssTheme();
  for (const radio of themeRadios) {
    if (radio.value === cssTheme) {
      radio.checked = true;
    }
  }
  updateSelectedStyles(themeRadioItems, cssTheme, "theme");
}

/**
 * 選択されたラジオボタンの値を取得
 */
function getSelectedRadioValue<T extends string>(
  radios: NodeListOf<HTMLInputElement>,
  defaultValue: T,
): T {
  for (const radio of radios) {
    if (radio.checked) {
      return radio.value as T;
    }
  }
  return defaultValue;
}

/**
 * Netlify OAuth 状態を更新
 */
async function updateNetlifyOAuthStatus(
  netlifyOAuthStatus: HTMLDivElement,
  netlifyOAuthBtn: HTMLButtonElement,
  netlifyLogoutBtn: HTMLButtonElement,
  netlifyTokenInput: HTMLInputElement,
) {
  const result = await getNetlifyOAuthToken();

  await result.match(
    async (token) => {
      if (token) {
        // OAuth 認証済み - ユーザー情報を取得
        const userResult = await getNetlifyUser(token);
        userResult.match(
          (user) => {
            netlifyOAuthStatus.className = "oauth-status authenticated";
            netlifyOAuthStatus.innerHTML = `
              <div class="user-info">
                <img src="${user.avatar_url}" alt="${user.full_name}" class="user-avatar">
                <span>Signed in as <strong>${user.full_name || user.email}</strong></span>
              </div>
            `;
            netlifyOAuthBtn.style.display = "none";
            netlifyLogoutBtn.style.display = "inline-block";
            netlifyTokenInput.disabled = true;
            netlifyTokenInput.placeholder = "Using OAuth authentication";
          },
          () => {
            // トークンが無効な場合
            showNetlifyNotAuthenticated(
              netlifyOAuthStatus,
              netlifyOAuthBtn,
              netlifyLogoutBtn,
              netlifyTokenInput,
            );
          },
        );
      } else {
        showNetlifyNotAuthenticated(
          netlifyOAuthStatus,
          netlifyOAuthBtn,
          netlifyLogoutBtn,
          netlifyTokenInput,
        );
      }
    },
    () => {
      showNetlifyNotAuthenticated(
        netlifyOAuthStatus,
        netlifyOAuthBtn,
        netlifyLogoutBtn,
        netlifyTokenInput,
      );
    },
  );
}

/**
 * Netlify 未認証状態を表示
 */
function showNetlifyNotAuthenticated(
  netlifyOAuthStatus: HTMLDivElement,
  netlifyOAuthBtn: HTMLButtonElement,
  netlifyLogoutBtn: HTMLButtonElement,
  netlifyTokenInput: HTMLInputElement,
) {
  netlifyOAuthStatus.className = "oauth-status not-authenticated";
  netlifyOAuthStatus.textContent = "Not signed in with Netlify";
  netlifyOAuthBtn.style.display = "inline-block";
  netlifyLogoutBtn.style.display = "none";
  netlifyTokenInput.disabled = false;
  netlifyTokenInput.placeholder = "Enter your Netlify token";
}

/**
 * Netlify OAuth ログイン処理
 */
async function handleNetlifyOAuthLogin(
  netlifyOAuthStatus: HTMLDivElement,
  netlifyOAuthBtn: HTMLButtonElement,
  netlifyLogoutBtn: HTMLButtonElement,
  netlifyTokenInput: HTMLInputElement,
  messageSpan: HTMLSpanElement,
) {
  netlifyOAuthBtn.disabled = true;
  netlifyOAuthBtn.textContent = "Signing in...";

  const result = await startNetlifyOAuth();

  result.match(
    () => {
      showMessage(messageSpan, "Netlify authentication successful!", "success");
      updateNetlifyOAuthStatus(
        netlifyOAuthStatus,
        netlifyOAuthBtn,
        netlifyLogoutBtn,
        netlifyTokenInput,
      );
    },
    (error) => {
      showMessage(messageSpan, error.message, "error");
    },
  );

  netlifyOAuthBtn.disabled = false;
  netlifyOAuthBtn.textContent = "Sign in with Netlify";
}

/**
 * Netlify OAuth ログアウト処理
 */
async function handleNetlifyOAuthLogout(
  netlifyOAuthStatus: HTMLDivElement,
  netlifyOAuthBtn: HTMLButtonElement,
  netlifyLogoutBtn: HTMLButtonElement,
  netlifyTokenInput: HTMLInputElement,
  messageSpan: HTMLSpanElement,
) {
  const result = await clearNetlifyOAuthToken();

  result.match(
    () => {
      showMessage(messageSpan, "Signed out from Netlify", "success");
      updateNetlifyOAuthStatus(
        netlifyOAuthStatus,
        netlifyOAuthBtn,
        netlifyLogoutBtn,
        netlifyTokenInput,
      );
    },
    (error) => {
      showMessage(messageSpan, error.message, "error");
    },
  );
}

/**
 * GitHub OAuth 状態を更新
 */
async function updateGitHubOAuthStatus(
  githubOAuthStatus: HTMLDivElement,
  githubOAuthBtn: HTMLButtonElement,
  githubLogoutBtn: HTMLButtonElement,
  githubTokenInput: HTMLInputElement,
) {
  const result = await getGitHubOAuthToken();

  await result.match(
    async (token) => {
      if (token) {
        // OAuth 認証済み - ユーザー情報を取得
        const userResult = await getGitHubUser(token);
        userResult.match(
          (user) => {
            githubOAuthStatus.className = "oauth-status authenticated";
            githubOAuthStatus.innerHTML = `
              <div class="user-info">
                <img src="${user.avatar_url}" alt="${user.login}" class="user-avatar">
                <span>Signed in as <strong>${user.login}</strong></span>
              </div>
            `;
            githubOAuthBtn.style.display = "none";
            githubLogoutBtn.style.display = "inline-block";
            githubTokenInput.disabled = true;
            githubTokenInput.placeholder = "Using OAuth authentication";
          },
          () => {
            // トークンが無効な場合
            showNotAuthenticated(
              githubOAuthStatus,
              githubOAuthBtn,
              githubLogoutBtn,
              githubTokenInput,
            );
          },
        );
      } else {
        showNotAuthenticated(
          githubOAuthStatus,
          githubOAuthBtn,
          githubLogoutBtn,
          githubTokenInput,
        );
      }
    },
    () => {
      showNotAuthenticated(
        githubOAuthStatus,
        githubOAuthBtn,
        githubLogoutBtn,
        githubTokenInput,
      );
    },
  );
}

/**
 * 未認証状態を表示
 */
function showNotAuthenticated(
  githubOAuthStatus: HTMLDivElement,
  githubOAuthBtn: HTMLButtonElement,
  githubLogoutBtn: HTMLButtonElement,
  githubTokenInput: HTMLInputElement,
) {
  githubOAuthStatus.className = "oauth-status not-authenticated";
  githubOAuthStatus.textContent = "Not signed in with GitHub";
  githubOAuthBtn.style.display = "inline-block";
  githubLogoutBtn.style.display = "none";
  githubTokenInput.disabled = false;
  githubTokenInput.placeholder = "Enter your GitHub token";
}

/**
 * GitHub OAuth ログイン処理
 */
async function handleGitHubOAuthLogin(
  githubOAuthStatus: HTMLDivElement,
  githubOAuthBtn: HTMLButtonElement,
  githubLogoutBtn: HTMLButtonElement,
  githubTokenInput: HTMLInputElement,
  messageSpan: HTMLSpanElement,
) {
  githubOAuthBtn.disabled = true;
  githubOAuthBtn.textContent = "Signing in...";

  const result = await startGitHubOAuth();

  result.match(
    () => {
      showMessage(messageSpan, "GitHub authentication successful!", "success");
      updateGitHubOAuthStatus(
        githubOAuthStatus,
        githubOAuthBtn,
        githubLogoutBtn,
        githubTokenInput,
      );
    },
    (error) => {
      showMessage(messageSpan, error.message, "error");
    },
  );

  githubOAuthBtn.disabled = false;
  githubOAuthBtn.textContent = "Sign in with GitHub";
}

/**
 * GitHub OAuth ログアウト処理
 */
async function handleGitHubOAuthLogout(
  githubOAuthStatus: HTMLDivElement,
  githubOAuthBtn: HTMLButtonElement,
  githubLogoutBtn: HTMLButtonElement,
  githubTokenInput: HTMLInputElement,
  messageSpan: HTMLSpanElement,
) {
  const result = await clearGitHubOAuthToken();

  result.match(
    () => {
      showMessage(messageSpan, "Signed out from GitHub", "success");
      updateGitHubOAuthStatus(
        githubOAuthStatus,
        githubOAuthBtn,
        githubLogoutBtn,
        githubTokenInput,
      );
    },
    (error) => {
      showMessage(messageSpan, error.message, "error");
    },
  );
}

/**
 * 初期化
 */
document.addEventListener("DOMContentLoaded", () => {
  const elements = getElements();
  if (!elements) {
    return;
  }

  const {
    netlifyTokenInput,
    netlifyOAuthBtn,
    netlifyLogoutBtn,
    netlifyOAuthStatus,
    vercelTokenInput,
    cloudflareAccountIdInput,
    cloudflareTokenInput,
    githubTokenInput,
    githubOAuthBtn,
    githubLogoutBtn,
    githubOAuthStatus,
    saveButton,
    messageSpan,
    providerRadios,
    providerRadioItems,
    themeRadios,
    themeRadioItems,
  } = elements;

  // 保存済み設定を読み込み
  loadSettings(
    netlifyTokenInput,
    vercelTokenInput,
    cloudflareAccountIdInput,
    cloudflareTokenInput,
    githubTokenInput,
    providerRadios,
    providerRadioItems,
    themeRadios,
    themeRadioItems,
  );

  // Netlify OAuth 状態を読み込み
  updateNetlifyOAuthStatus(
    netlifyOAuthStatus,
    netlifyOAuthBtn,
    netlifyLogoutBtn,
    netlifyTokenInput,
  );

  // GitHub OAuth 状態を読み込み
  updateGitHubOAuthStatus(
    githubOAuthStatus,
    githubOAuthBtn,
    githubLogoutBtn,
    githubTokenInput,
  );

  // プロバイダーラジオボタンの変更イベント
  for (const radio of providerRadios) {
    radio.addEventListener("change", () => {
      updateSelectedStyles(providerRadioItems, radio.value, "provider");
    });
  }

  // テーマラジオボタンの変更イベント
  for (const radio of themeRadios) {
    radio.addEventListener("change", () => {
      updateSelectedStyles(themeRadioItems, radio.value, "theme");
    });
  }

  // Netlify OAuth ログインボタン
  netlifyOAuthBtn.addEventListener("click", () => {
    handleNetlifyOAuthLogin(
      netlifyOAuthStatus,
      netlifyOAuthBtn,
      netlifyLogoutBtn,
      netlifyTokenInput,
      messageSpan,
    );
  });

  // Netlify OAuth ログアウトボタン
  netlifyLogoutBtn.addEventListener("click", () => {
    handleNetlifyOAuthLogout(
      netlifyOAuthStatus,
      netlifyOAuthBtn,
      netlifyLogoutBtn,
      netlifyTokenInput,
      messageSpan,
    );
  });

  // GitHub OAuth ログインボタン
  githubOAuthBtn.addEventListener("click", () => {
    handleGitHubOAuthLogin(
      githubOAuthStatus,
      githubOAuthBtn,
      githubLogoutBtn,
      githubTokenInput,
      messageSpan,
    );
  });

  // GitHub OAuth ログアウトボタン
  githubLogoutBtn.addEventListener("click", () => {
    handleGitHubOAuthLogout(
      githubOAuthStatus,
      githubOAuthBtn,
      githubLogoutBtn,
      githubTokenInput,
      messageSpan,
    );
  });

  // 保存ボタンのクリックイベント
  saveButton.addEventListener("click", () => {
    const selectedProvider = getSelectedRadioValue<DeployProvider>(
      providerRadios,
      "netlify",
    );
    const selectedTheme = getSelectedRadioValue<CssTheme>(
      themeRadios,
      "default",
    );
    saveSettings(
      netlifyTokenInput.value,
      vercelTokenInput.value,
      cloudflareAccountIdInput.value,
      cloudflareTokenInput.value,
      githubTokenInput.value,
      selectedProvider,
      selectedTheme,
      messageSpan,
    );
  });
});
