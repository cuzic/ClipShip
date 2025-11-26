/**
 * Options ページロジック
 * トークンの保存・読み込み、デフォルトプロバイダーの設定
 */

import {
  type DeployProvider,
  getDefaultProvider,
  getMultipleStorageData,
  setMultipleStorageData,
} from "./lib/storage";

/**
 * DOM要素の取得
 */
function getElements() {
  const netlifyTokenInput = document.getElementById(
    "netlifyToken",
  ) as HTMLInputElement;
  const vercelTokenInput = document.getElementById(
    "vercelToken",
  ) as HTMLInputElement;
  const cloudflareAccountIdInput = document.getElementById(
    "cloudflareAccountId",
  ) as HTMLInputElement;
  const cloudflareTokenInput = document.getElementById(
    "cloudflareToken",
  ) as HTMLInputElement;
  const githubTokenInput = document.getElementById(
    "githubToken",
  ) as HTMLInputElement;
  const saveButton = document.getElementById("save") as HTMLButtonElement;
  const messageSpan = document.getElementById("message") as HTMLSpanElement;
  const providerRadios = document.querySelectorAll<HTMLInputElement>(
    'input[name="defaultProvider"]',
  );
  const radioItems = document.querySelectorAll<HTMLLabelElement>(".radio-item");

  return {
    netlifyTokenInput,
    vercelTokenInput,
    cloudflareAccountIdInput,
    cloudflareTokenInput,
    githubTokenInput,
    saveButton,
    messageSpan,
    providerRadios,
    radioItems,
  };
}

/**
 * 選択されたプロバイダーのスタイルを更新
 */
function updateRadioStyles(
  radioItems: NodeListOf<HTMLLabelElement>,
  selectedProvider: string,
) {
  for (const item of radioItems) {
    if (item.dataset.provider === selectedProvider) {
      item.classList.add("selected");
    } else {
      item.classList.remove("selected");
    }
  }
}

/**
 * 保存成功メッセージを表示
 */
function showSaveMessage(messageSpan: HTMLSpanElement) {
  messageSpan.textContent = "Saved!";
  setTimeout(() => {
    messageSpan.textContent = "";
  }, 2000);
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
  messageSpan: HTMLSpanElement,
) {
  await setMultipleStorageData({
    netlifyToken,
    vercelToken,
    cloudflareAccountId,
    cloudflareToken,
    githubToken,
    defaultProvider,
  });
  showSaveMessage(messageSpan);
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
  radioItems: NodeListOf<HTMLLabelElement>,
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
  updateRadioStyles(radioItems, defaultProvider);
}

/**
 * 選択されたプロバイダーを取得
 */
function getSelectedProvider(
  providerRadios: NodeListOf<HTMLInputElement>,
): DeployProvider {
  for (const radio of providerRadios) {
    if (radio.checked) {
      return radio.value as DeployProvider;
    }
  }
  return "netlify";
}

/**
 * 初期化
 */
document.addEventListener("DOMContentLoaded", () => {
  const {
    netlifyTokenInput,
    vercelTokenInput,
    cloudflareAccountIdInput,
    cloudflareTokenInput,
    githubTokenInput,
    saveButton,
    messageSpan,
    providerRadios,
    radioItems,
  } = getElements();

  // 保存済み設定を読み込み
  loadSettings(
    netlifyTokenInput,
    vercelTokenInput,
    cloudflareAccountIdInput,
    cloudflareTokenInput,
    githubTokenInput,
    providerRadios,
    radioItems,
  );

  // ラジオボタンの変更イベント
  for (const radio of providerRadios) {
    radio.addEventListener("change", () => {
      updateRadioStyles(radioItems, radio.value);
    });
  }

  // 保存ボタンのクリックイベント
  saveButton.addEventListener("click", () => {
    const selectedProvider = getSelectedProvider(providerRadios);
    saveSettings(
      netlifyTokenInput.value,
      vercelTokenInput.value,
      cloudflareAccountIdInput.value,
      cloudflareTokenInput.value,
      githubTokenInput.value,
      selectedProvider,
      messageSpan,
    );
  });
});
