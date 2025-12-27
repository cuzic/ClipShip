/**
 * Gist ファイル管理ページのメインロジック
 */

import {
  type GistFileInfo,
  deleteFileFromGist,
  listGistFiles,
  updateFileInGist,
} from "./lib/gist";
import { type CssTheme, getCssTheme, getStorageData } from "./lib/storage";

/**
 * GitHub トークンを取得
 */
async function getGitHubToken(): Promise<string | null> {
  const oauthToken = await getStorageData("githubOAuthToken");
  const manualToken = await getStorageData("githubToken");
  return oauthToken || manualToken || null;
}

/**
 * ファイルサイズをフォーマット
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * ファイル名から日付を抽出
 * 形式: page-YYYYMMDD-xxxx.html
 */
function extractDateFromFilename(filename: string): string | null {
  const match = filename.match(/page-(\d{4})(\d{2})(\d{2})-/);
  if (match) {
    return `${match[1]}/${match[2]}/${match[3]}`;
  }
  return null;
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
 * トースト通知を表示
 */
function showToast(
  message: string,
  type: "success" | "error" | "info" = "info",
) {
  const toast = document.getElementById("toast") as HTMLDivElement;
  toast.textContent = message;
  toast.className = "toast show";
  if (type !== "info") {
    toast.classList.add(type);
  }

  setTimeout(() => {
    toast.classList.remove("show", "success", "error");
  }, 3000);
}

/**
 * ファイルアイテムの HTML を生成
 */
function createFileItemHtml(file: GistFileInfo): string {
  const escapedFilename = escapeHtml(file.filename);
  const escapedUrl = escapeHtml(file.previewUrl);
  const date = extractDateFromFilename(file.filename);
  const meta = [date, formatSize(file.size)].filter(Boolean).join(" · ");

  return `
    <div class="file-item" data-filename="${escapedFilename}">
      <span class="file-icon">📄</span>
      <div class="file-content">
        <div class="file-name">${escapedFilename}</div>
        <div class="file-meta">${meta}</div>
        <a href="${escapedUrl}" target="_blank" rel="noopener noreferrer" class="file-url">${escapedUrl}</a>
      </div>
      <div class="file-actions">
        <button class="btn-icon preview" type="button" title="Preview">👁️</button>
        <button class="btn-icon copy" type="button" title="Copy URL">📋</button>
        <button class="btn-icon reupload" type="button" title="Re-upload">🔄</button>
        <button class="btn-icon delete" type="button" title="Delete">🗑️</button>
      </div>
    </div>
  `;
}

/**
 * ファイル一覧を描画
 */
async function renderFileList(): Promise<void> {
  const container = document.getElementById("file-container") as HTMLDivElement;

  const token = await getGitHubToken();
  if (!token) {
    container.innerHTML = `
      <div class="error-state">
        <p>GitHub token is not configured.</p>
        <p><a href="options.html">Go to Settings</a> to set up GitHub authentication.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = '<div class="loading">Loading...</div>';

  const result = await listGistFiles(token);

  result.match(
    (files) => {
      if (files.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <p>No files in Gist</p>
            <small>Deploy content from the popup to add files</small>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div class="file-list">
          ${files.map(createFileItemHtml).join("")}
        </div>
      `;
    },
    (error) => {
      container.innerHTML = `
        <div class="error-state">
          <p>Failed to load files</p>
          <p>${escapeHtml(error.message)}</p>
        </div>
      `;
    },
  );
}

/**
 * プレビューボタンのハンドラ
 */
function handlePreview(item: HTMLElement): void {
  const url = item.querySelector(".file-url")?.getAttribute("href");
  if (url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/**
 * コピーボタンのハンドラ
 */
async function handleCopy(item: HTMLElement): Promise<void> {
  const url = item.querySelector(".file-url")?.textContent;
  if (url) {
    await navigator.clipboard.writeText(url);
    showToast("URL copied to clipboard!", "success");
  }
}

/**
 * 再アップロードボタンのハンドラ
 */
async function handleReupload(item: HTMLElement): Promise<void> {
  const filename = item.dataset.filename;
  if (!filename) return;

  const token = await getGitHubToken();
  if (!token) {
    showToast("GitHub token not configured", "error");
    return;
  }

  if (
    !confirm(
      `Re-upload "${filename}"?\n\nThis will replace the current content with your clipboard content.`,
    )
  ) {
    return;
  }

  // クリップボードからテキストを取得
  let clipboardText: string;
  try {
    clipboardText = await navigator.clipboard.readText();
  } catch {
    showToast("Failed to read clipboard", "error");
    return;
  }

  if (!clipboardText.trim()) {
    showToast("Clipboard is empty", "error");
    return;
  }

  // ボタンを無効化
  const buttons = item.querySelectorAll("button");
  for (const btn of buttons) {
    btn.disabled = true;
  }

  // テーマを取得
  const theme: CssTheme = await getCssTheme();

  const result = await updateFileInGist(token, filename, clipboardText, theme);

  result.match(
    (url) => {
      showToast("File updated successfully!", "success");
      // URL をクリップボードにコピー
      navigator.clipboard.writeText(url);
    },
    (error) => {
      showToast(`Failed to update: ${error.message}`, "error");
    },
  );

  // ボタンを再有効化
  for (const btn of buttons) {
    btn.disabled = false;
  }
}

/**
 * 削除ボタンのハンドラ
 */
async function handleDelete(item: HTMLElement): Promise<void> {
  const filename = item.dataset.filename;
  if (!filename) return;

  const token = await getGitHubToken();
  if (!token) {
    showToast("GitHub token not configured", "error");
    return;
  }

  if (!confirm(`Delete "${filename}"?\n\nThis cannot be undone.`)) {
    return;
  }

  // ボタンを無効化
  const buttons = item.querySelectorAll("button");
  for (const btn of buttons) {
    btn.disabled = true;
  }

  const result = await deleteFileFromGist(token, filename);

  result.match(
    () => {
      showToast("File deleted", "success");
      renderFileList();
    },
    (error) => {
      showToast(`Failed to delete: ${error.message}`, "error");
      for (const btn of buttons) {
        btn.disabled = false;
      }
    },
  );
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

    const item = button.closest(".file-item");
    if (!item || !(item instanceof HTMLElement)) return;

    if (button.classList.contains("preview")) {
      handlePreview(item);
    } else if (button.classList.contains("copy")) {
      await handleCopy(item);
    } else if (button.classList.contains("reupload")) {
      await handleReupload(item);
    } else if (button.classList.contains("delete")) {
      await handleDelete(item);
    }
  });
}

/**
 * 初期化
 */
document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("file-container");

  if (!container) {
    console.error("Required elements not found");
    return;
  }

  // イベント委譲を設定（一度だけ）
  setupEventListeners(container);

  // ファイル一覧を描画
  await renderFileList();
});
