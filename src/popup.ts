/**
 * Popup メインロジック
 * Netlify / GistHack へのデプロイ処理
 */

import { deployToGist } from "./lib/gist";
import { deployToNetlify } from "./lib/netlify";
import { getStorageData } from "./lib/storage";

/**
 * DOM要素の取得
 */
function getElements() {
  const statusDiv = document.getElementById("status") as HTMLDivElement;
  const netlifyBtn = document.getElementById(
    "btn-netlify",
  ) as HTMLButtonElement;
  const gistBtn = document.getElementById("btn-gist") as HTMLButtonElement;
  return { statusDiv, netlifyBtn, gistBtn };
}

/**
 * ステータス表示: 成功
 */
async function showSuccess(statusDiv: HTMLDivElement, url: string) {
  statusDiv.innerHTML = `<span class="success">Success!</span><br><a href="${url}" target="_blank">${url}</a>`;
  await navigator.clipboard.writeText(url);
  statusDiv.innerHTML += "<br><br>Copied to clipboard!";
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
 * ボタンの有効/無効を切り替え
 */
function setButtonsDisabled(buttons: HTMLButtonElement[], disabled: boolean) {
  for (const btn of buttons) {
    btn.disabled = disabled;
  }
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
  buttons: HTMLButtonElement[],
) {
  setButtonsDisabled(buttons, true);
  showLoading(statusDiv, "Packing & Uploading to Netlify...");

  try {
    const token = await getStorageData("netlifyToken");
    if (!token) {
      throw new Error("Netlify Token not set in Options.");
    }

    const text = await getClipboardText();
    const result = await deployToNetlify(token, text);
    await showSuccess(statusDiv, result.ssl_url ?? result.url);
  } catch (error) {
    showError(statusDiv, (error as Error).message);
  } finally {
    setButtonsDisabled(buttons, false);
  }
}

/**
 * GistHack デプロイ処理
 */
async function handleGistDeploy(
  statusDiv: HTMLDivElement,
  buttons: HTMLButtonElement[],
) {
  setButtonsDisabled(buttons, true);
  showLoading(statusDiv, "Creating Gist...");

  try {
    const token = await getStorageData("githubToken");
    if (!token) {
      throw new Error("GitHub Token not set in Options.");
    }

    const text = await getClipboardText();
    const url = await deployToGist(token, text);
    await showSuccess(statusDiv, url);
  } catch (error) {
    showError(statusDiv, (error as Error).message);
  } finally {
    setButtonsDisabled(buttons, false);
  }
}

/**
 * 初期化
 */
document.addEventListener("DOMContentLoaded", () => {
  const { statusDiv, netlifyBtn, gistBtn } = getElements();
  const buttons = [netlifyBtn, gistBtn];

  netlifyBtn.addEventListener("click", () => {
    handleNetlifyDeploy(statusDiv, buttons);
  });

  gistBtn.addEventListener("click", () => {
    handleGistDeploy(statusDiv, buttons);
  });
});
