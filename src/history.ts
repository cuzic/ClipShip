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
 * 履歴アイテムの HTML を生成
 */
function createHistoryItemHtml(entry: DeployHistoryEntry): string {
  return `
    <div class="history-item" data-id="${entry.id}">
      <span class="provider-badge ${entry.provider}">${PROVIDER_NAMES[entry.provider]}</span>
      <div class="history-content">
        <div class="history-title">
          <span class="title-text">${escapeHtml(entry.title)}</span>
          <span class="content-type">${CONTENT_TYPE_NAMES[entry.contentType] || entry.contentType}</span>
        </div>
        <a href="${entry.url}" target="_blank" class="history-url">${entry.url}</a>
        <div class="history-meta">${formatDate(entry.deployedAt)}</div>
      </div>
      <div class="history-actions">
        <button class="btn-icon copy" title="Copy URL">📋</button>
        <button class="btn-icon edit" title="Edit title">✏️</button>
        <button class="btn-icon delete" title="Delete">🗑️</button>
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
    <div class="history-list">
      ${history.map(createHistoryItemHtml).join("")}
    </div>
  `;

  // イベントリスナーを設定
  setupEventListeners();
}

/**
 * イベントリスナーを設定
 */
function setupEventListeners() {
  const container = document.getElementById(
    "history-container",
  ) as HTMLDivElement;

  // コピーボタン
  for (const btn of container.querySelectorAll(".btn-icon.copy")) {
    btn.addEventListener("click", async (e) => {
      const item = (e.target as HTMLElement).closest(".history-item");
      const url = item?.querySelector(".history-url")?.textContent;
      if (url) {
        await navigator.clipboard.writeText(url);
        showToast("URL copied to clipboard!");
      }
    });
  }

  // 編集ボタン
  for (const btn of container.querySelectorAll(".btn-icon.edit")) {
    btn.addEventListener("click", (e) => {
      const item = (e.target as HTMLElement).closest(
        ".history-item",
      ) as HTMLElement;
      const id = item.dataset.id;
      const titleSpan = item.querySelector(".title-text") as HTMLElement;
      const currentTitle = titleSpan.textContent || "";

      // 入力フィールドに置き換え
      const input = document.createElement("input");
      input.type = "text";
      input.value = currentTitle;
      input.style.cssText =
        "flex: 1; font-size: 15px; font-weight: 600; border: 1px solid #0066cc; border-radius: 4px; padding: 4px 8px;";

      const titleDiv = titleSpan.parentElement as HTMLElement;
      titleDiv.replaceChild(input, titleSpan);
      input.focus();
      input.select();

      // 保存処理
      const saveTitle = async () => {
        const newTitle = input.value.trim() || currentTitle;
        if (id && newTitle !== currentTitle) {
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
    });
  }

  // 削除ボタン
  for (const btn of container.querySelectorAll(".btn-icon.delete")) {
    btn.addEventListener("click", async (e) => {
      const item = (e.target as HTMLElement).closest(
        ".history-item",
      ) as HTMLElement;
      const id = item.dataset.id;

      if (id && confirm("Delete this entry?")) {
        await deleteDeployHistory(id);
        await renderHistory();
        showToast("Entry deleted");
      }
    });
  }
}

/**
 * 初期化
 */
document.addEventListener("DOMContentLoaded", async () => {
  await renderHistory();

  // Clear All ボタン
  const clearBtn = document.getElementById("btn-clear") as HTMLButtonElement;
  clearBtn.addEventListener("click", async () => {
    if (confirm("Clear all deploy history? This cannot be undone.")) {
      await clearDeployHistory();
      await renderHistory();
      showToast("History cleared");
    }
  });
});
