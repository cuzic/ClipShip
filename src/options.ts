/**
 * Options ページロジック
 * トークンの保存・読み込み、デフォルトプロバイダーの設定
 */

import {
  type CssTheme,
  type DeployProvider,
  getCssTheme,
  getDefaultProvider,
  getMultipleStorageData,
  setMultipleStorageData,
} from "./lib/storage";

/**
 * DOM要素の取得結果
 */
interface OptionsElements {
  netlifyTokenInput: HTMLInputElement;
  vercelTokenInput: HTMLInputElement;
  cloudflareAccountIdInput: HTMLInputElement;
  cloudflareTokenInput: HTMLInputElement;
  githubTokenInput: HTMLInputElement;
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
  const vercelTokenInput = document.getElementById("vercelToken");
  const cloudflareAccountIdInput = document.getElementById(
    "cloudflareAccountId",
  );
  const cloudflareTokenInput = document.getElementById("cloudflareToken");
  const githubTokenInput = document.getElementById("githubToken");
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
    !(vercelTokenInput instanceof HTMLInputElement) ||
    !(cloudflareAccountIdInput instanceof HTMLInputElement) ||
    !(cloudflareTokenInput instanceof HTMLInputElement) ||
    !(githubTokenInput instanceof HTMLInputElement) ||
    !(saveButton instanceof HTMLButtonElement) ||
    !(messageSpan instanceof HTMLSpanElement)
  ) {
    console.error("Required DOM elements not found");
    return null;
  }

  return {
    netlifyTokenInput,
    vercelTokenInput,
    cloudflareAccountIdInput,
    cloudflareTokenInput,
    githubTokenInput,
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
function validateSettings(
  netlifyToken: string,
  vercelToken: string,
  cloudflareAccountId: string,
  cloudflareToken: string,
  githubToken: string,
  defaultProvider: DeployProvider,
): string | null {
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

  // デフォルトプロバイダーに対応するトークンが設定されているか
  const tokenMap: Record<DeployProvider, string> = {
    netlify: netlifyToken,
    vercel: vercelToken,
    cloudflare: cloudflareToken,
    gist: githubToken,
  };

  if (!tokenMap[defaultProvider]?.trim()) {
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
  const error = validateSettings(
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
 * 初期化
 */
document.addEventListener("DOMContentLoaded", () => {
  const elements = getElements();
  if (!elements) {
    return;
  }

  const {
    netlifyTokenInput,
    vercelTokenInput,
    cloudflareAccountIdInput,
    cloudflareTokenInput,
    githubTokenInput,
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
