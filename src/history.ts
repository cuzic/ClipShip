/**
 * 履歴ページのメインロジック
 */

import {
  type DeployHistoryEntry,
  type DeployProvider,
  clearDeployHistory,
  deleteDeployHistory,
  getDeployHistory,
  updateDeployHistoryTitle,
} from "./lib/storage";

/**
 * プロバイダー名の表示用マッピング
 */
const PROVIDER_NAMES: Record<DeployProvider, string> = {
  netlify: "Netlify",
  vercel: "Vercel",
  cloudflare: "Cloudflare",
  gist: "Gist",
};

/**
 * コンテンツタイプの表示用マッピング
 */
const CONTENT_TYPE_NAMES: Record<string, string> = {
  html: "HTML",
  markdown: "MD",
  text: "TXT",
};

/**
 * 日時をフォーマット
 */
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

/**
 * トースト通知を表示
 */
function showToast(message: string) {
  const toast = document.getElementById("toast") as HTMLDivElement;
  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2000);
}

/**
 * 履歴アイテムの HTML を生成（アクセシビリティ対応）
 */
function createHistoryItemHtml(entry: DeployHistoryEntry): string {
  const escapedTitle = escapeHtml(entry.title);
  const escapedUrl = escapeHtml(entry.url);
  return `
    <div class="history-item" data-id="${entry.id}" role="listitem">
      <span class="provider-badge ${entry.provider}">${PROVIDER_NAMES[entry.provider]}</span>
      <div class="history-content">
        <div class="history-title">
          <span class="title-text">${escapedTitle}</span>
          <span class="content-type">${CONTENT_TYPE_NAMES[entry.contentType] || entry.contentType}</span>
        </div>
        <a href="${entry.url}" target="_blank" rel="noopener noreferrer" class="history-url">${escapedUrl}</a>
        <div class="history-meta">${formatDate(entry.deployedAt)}</div>
      </div>
      <div class="history-actions" role="group" aria-label="Actions for ${escapedTitle}">
        <button class="btn-icon copy" type="button" aria-label="Copy URL to clipboard" title="Copy URL">📋</button>
        <button class="btn-icon edit" type="button" aria-label="Edit title" title="Edit title">✏️</button>
        <button class="btn-icon delete" type="button" aria-label="Delete entry" title="Delete">🗑️</button>
      </div>
    </div>
  `;
}

/**
 * HTML エスケープ
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * 履歴リストを描画
 */
async function renderHistory() {
  const container = document.getElementById(
    "history-container",
  ) as HTMLDivElement;
  const clearBtn = document.getElementById("btn-clear") as HTMLButtonElement;
  const history = await getDeployHistory();

  if (history.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No deploy history yet</p>
        <small>Deploy content from the popup to see it here</small>
      </div>
    `;
    clearBtn.disabled = true;
    return;
  }

  clearBtn.disabled = false;
  container.innerHTML = `
    <div class="history-list" role="list" aria-label="Deploy history">
      ${history.map(createHistoryItemHtml).join("")}
    </div>
  `;
}

/**
 * コピーボタンのハンドラ
 */
async function handleCopy(item: HTMLElement): Promise<void> {
  const url = item.querySelector(".history-url")?.textContent;
  if (url) {
    await navigator.clipboard.writeText(url);
    showToast("URL copied to clipboard!");
  }
}

/**
 * 編集ボタンのハンドラ
 */
function handleEdit(item: HTMLElement): void {
  const id = item.dataset.id;
  if (!id) return;

  const titleSpan = item.querySelector(".title-text");
  if (!titleSpan || !(titleSpan instanceof HTMLElement)) return;

  const currentTitle = titleSpan.textContent || "";
  const titleDiv = titleSpan.parentElement;
  if (!titleDiv) return;

  // 入力フィールドに置き換え
  const input = document.createElement("input");
  input.type = "text";
  input.value = currentTitle;
  input.setAttribute("aria-label", "Edit title");
  input.style.cssText =
    "flex: 1; font-size: 15px; font-weight: 600; border: 1px solid #0066cc; border-radius: 4px; padding: 4px 8px;";

  titleDiv.replaceChild(input, titleSpan);
  input.focus();
  input.select();

  // 保存処理
  const saveTitle = async () => {
    const newTitle = input.value.trim() || currentTitle;
    if (newTitle !== currentTitle) {
      await updateDeployHistoryTitle(id, newTitle);
      showToast("Title updated!");
    }

    const newSpan = document.createElement("span");
    newSpan.className = "title-text";
    newSpan.textContent = newTitle;
    titleDiv.replaceChild(newSpan, input);
  };

  input.addEventListener("blur", saveTitle);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      input.blur();
    } else if (e.key === "Escape") {
      input.value = currentTitle;
      input.blur();
    }
  });
}

/**
 * 削除ボタンのハンドラ
 */
async function handleDelete(item: HTMLElement): Promise<void> {
  const id = item.dataset.id;
  if (!id) return;

  if (confirm("Delete this entry?")) {
    await deleteDeployHistory(id);
    await renderHistory();
    showToast("Entry deleted");
  }
}

/**
 * イベント委譲を使ったイベントリスナーを設定
 */
function setupEventListeners(container: HTMLElement): void {
  container.addEventListener("click", async (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    const button = target.closest("button");
    if (!button) return;

    const item = button.closest(".history-item");
    if (!item || !(item instanceof HTMLElement)) return;

    if (button.classList.contains("copy")) {
      await handleCopy(item);
    } else if (button.classList.contains("edit")) {
      handleEdit(item);
    } else if (button.classList.contains("delete")) {
      await handleDelete(item);
    }
  });

  // キーボードナビゲーション対応
  container.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;

    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    const button = target.closest("button");
    if (!button) return;

    // スペースキーでのスクロールを防止
    if (e.key === " ") {
      e.preventDefault();
    }

    // クリックイベントをトリガー
    button.click();
  });
}

/**
 * 初期化
 */
document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("history-container");
  const clearBtn = document.getElementById("btn-clear");

  if (!container || !clearBtn) {
    console.error("Required elements not found");
    return;
  }

  // イベント委譲を設定（一度だけ）
  setupEventListeners(container);

  // 履歴を描画
  await renderHistory();

  // Clear All ボタン
  clearBtn.addEventListener("click", async () => {
    if (confirm("Clear all deploy history? This cannot be undone.")) {
      await clearDeployHistory();
      await renderHistory();
      showToast("History cleared");
    }
  });
});
