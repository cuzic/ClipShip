/**
 * Options ページロジック
 * トークンの保存・読み込み
 */

import { getMultipleStorageData, setMultipleStorageData } from "./lib/storage";

/**
 * DOM要素の取得
 */
function getElements() {
  const netlifyTokenInput = document.getElementById(
    "netlifyToken",
  ) as HTMLInputElement;
  const githubTokenInput = document.getElementById(
    "githubToken",
  ) as HTMLInputElement;
  const saveButton = document.getElementById("save") as HTMLButtonElement;
  const messageSpan = document.getElementById("message") as HTMLSpanElement;
  return { netlifyTokenInput, githubTokenInput, saveButton, messageSpan };
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
 * トークンを保存
 */
async function saveTokens(
  netlifyToken: string,
  githubToken: string,
  messageSpan: HTMLSpanElement,
) {
  await setMultipleStorageData({
    netlifyToken,
    githubToken,
  });
  showSaveMessage(messageSpan);
}

/**
 * 保存済みトークンを読み込み
 */
async function loadTokens(
  netlifyTokenInput: HTMLInputElement,
  githubTokenInput: HTMLInputElement,
) {
  const data = await getMultipleStorageData(["netlifyToken", "githubToken"]);
  if (data.netlifyToken) {
    netlifyTokenInput.value = data.netlifyToken;
  }
  if (data.githubToken) {
    githubTokenInput.value = data.githubToken;
  }
}

/**
 * 初期化
 */
document.addEventListener("DOMContentLoaded", () => {
  const { netlifyTokenInput, githubTokenInput, saveButton, messageSpan } =
    getElements();

  // 保存済みトークンを読み込み
  loadTokens(netlifyTokenInput, githubTokenInput);

  // 保存ボタンのクリックイベント
  saveButton.addEventListener("click", () => {
    saveTokens(netlifyTokenInput.value, githubTokenInput.value, messageSpan);
  });
});
