/**
 * 目次ページ作成のメインロジック
 * 履歴から選択 + ドラッグ&ドロップで並び替え
 */

import { ResultAsync, errAsync, okAsync } from "neverthrow";
import { deployToCloudflare } from "./lib/cloudflare";
import type { DeployError } from "./lib/errors";
import { deployToGist } from "./lib/gist";
import { type TocEntry, generateTocHtml } from "./lib/html";
import { deployToNetlify } from "./lib/netlify";
import {
  type CssTheme,
  type DeployHistoryEntry,
  type DeployProvider,
  addDeployHistory,
  getCssTheme,
  getDefaultProvider,
  getDeployHistory,
  getStorageData,
} from "./lib/storage";
import { deployToVercel } from "./lib/vercel";

/**
 * 認証エラー
 */
class CredentialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredentialError";
  }
}

type TocError = DeployError | CredentialError;

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
    html: string,
    onProgress: (message: string) => void,
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
    deploy: (token, _accountId, html, onProgress) =>
      deployToNetlify(token, html, onProgress, "default").map(
        (r) => r.deployUrl,
      ),
  },
  vercel: {
    getCredentials: () =>
      ResultAsync.fromSafePromise(
        Promise.all([
          getStorageData("vercelOAuthToken"),
          getStorageData("vercelToken"),
        ]),
      ).andThen(([oauthToken, manualToken]) => {
        const token = oauthToken || manualToken;
        return token
          ? okAsync({ token })
          : errAsync(new CredentialError("Vercel Token not set in Options."));
      }),
    deploy: (token, _accountId, html, onProgress) =>
      deployToVercel(token, html, onProgress, "default").map(
        (r) => r.deployUrl,
      ),
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
    deploy: (token, accountId, html, onProgress) =>
      deployToCloudflare(
        token,
        accountId as string,
        html,
        onProgress,
        "default",
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
    deploy: (token, _accountId, html, onProgress) => {
      onProgress("Creating Gist...");
      return deployToGist(token, html, "default").map((r) => r.deployUrl);
    },
  },
};

/**
 * プロバイダー名
 */
const PROVIDER_NAMES: Record<DeployProvider, string> = {
  netlify: "Netlify",
  vercel: "Vercel",
  cloudflare: "CF",
  gist: "Gist",
};

/**
 * DOM 要素
 */
interface TocElements {
  tocTitle: HTMLInputElement;
  historyList: HTMLDivElement;
  historyCount: HTMLSpanElement;
  selectedList: HTMLDivElement;
  selectedCount: HTMLSpanElement;
  searchInput: HTMLInputElement;
  btnDeploy: HTMLButtonElement;
  status: HTMLDivElement;
}

/**
 * DOM 要素を取得
 */
function getElements(): TocElements | null {
  const tocTitle = document.getElementById("toc-title");
  const historyList = document.getElementById("history-list");
  const historyCount = document.getElementById("history-count");
  const selectedList = document.getElementById("selected-list");
  const selectedCount = document.getElementById("selected-count");
  const searchInput = document.getElementById("search-input");
  const btnDeploy = document.getElementById("btn-deploy");
  const status = document.getElementById("status");

  if (
    !(tocTitle instanceof HTMLInputElement) ||
    !(historyList instanceof HTMLDivElement) ||
    !(historyCount instanceof HTMLSpanElement) ||
    !(selectedList instanceof HTMLDivElement) ||
    !(selectedCount instanceof HTMLSpanElement) ||
    !(searchInput instanceof HTMLInputElement) ||
    !(btnDeploy instanceof HTMLButtonElement) ||
    !(status instanceof HTMLDivElement)
  ) {
    console.error("Required DOM elements not found");
    return null;
  }

  return {
    tocTitle,
    historyList,
    historyCount,
    selectedList,
    selectedCount,
    searchInput,
    btnDeploy,
    status,
  };
}

/**
 * 選択済みエントリのリスト
 */
let selectedEntries: TocEntry[] = [];
let allHistory: DeployHistoryEntry[] = [];
let elements: TocElements | null = null;

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
 * 履歴アイテムの HTML を生成
 */
function createHistoryItemHtml(entry: DeployHistoryEntry): string {
  const isSelected = selectedEntries.some((e) => e.url === entry.url);
  return `
    <div class="history-item ${isSelected ? "selected" : ""}" data-id="${entry.id}" data-url="${escapeHtml(entry.url)}" data-title="${escapeHtml(entry.title)}">
      <input type="checkbox" ${isSelected ? "checked" : ""}>
      <div class="history-item-content">
        <div class="history-item-title">${escapeHtml(entry.title)}</div>
        <div class="history-item-url">${escapeHtml(entry.url)}</div>
      </div>
      <span class="provider-badge ${entry.provider}">${PROVIDER_NAMES[entry.provider]}</span>
    </div>
  `;
}

/**
 * 選択済みアイテムの HTML を生成
 */
function createSelectedItemHtml(entry: TocEntry, index: number): string {
  return `
    <div class="selected-item" draggable="true" data-index="${index}" data-url="${escapeHtml(entry.url)}">
      <span class="drag-handle">☰</span>
      <div class="selected-item-content">
        <div class="selected-item-title">${escapeHtml(entry.title)}</div>
        <div class="selected-item-url">${escapeHtml(entry.url)}</div>
      </div>
      <button type="button" class="btn-remove">✕</button>
    </div>
  `;
}

/**
 * 履歴リストを描画
 */
function renderHistoryList(searchQuery = ""): void {
  if (!elements) return;

  const query = searchQuery.toLowerCase();
  const filtered = query
    ? allHistory.filter(
        (e) =>
          e.title.toLowerCase().includes(query) ||
          e.url.toLowerCase().includes(query),
      )
    : allHistory;

  if (filtered.length === 0) {
    elements.historyList.innerHTML = `
      <div class="empty-state">
        ${query ? "No matching pages found" : "No deploy history yet"}
      </div>
    `;
    elements.historyCount.textContent = "";
    return;
  }

  elements.historyList.innerHTML = filtered.map(createHistoryItemHtml).join("");
  elements.historyCount.textContent = `${filtered.length} pages`;
}

/**
 * 選択済みリストを描画
 */
function renderSelectedList(): void {
  if (!elements) return;

  if (selectedEntries.length === 0) {
    elements.selectedList.innerHTML = `
      <div class="empty-state">Select pages from history<br>or drag to reorder</div>
    `;
  } else {
    elements.selectedList.innerHTML = selectedEntries
      .map((e, i) => createSelectedItemHtml(e, i))
      .join("");
  }

  elements.selectedCount.textContent = `${selectedEntries.length} selected`;
  elements.btnDeploy.disabled = selectedEntries.length === 0;
}

/**
 * エントリを選択/解除
 */
function toggleEntry(entry: TocEntry): void {
  const existingIndex = selectedEntries.findIndex((e) => e.url === entry.url);

  if (existingIndex >= 0) {
    selectedEntries.splice(existingIndex, 1);
  } else {
    selectedEntries.push(entry);
  }

  renderHistoryList(elements?.searchInput.value || "");
  renderSelectedList();
}

/**
 * エントリを削除
 */
function removeEntry(url: string): void {
  selectedEntries = selectedEntries.filter((e) => e.url !== url);
  renderHistoryList(elements?.searchInput.value || "");
  renderSelectedList();
}

/**
 * ドラッグ&ドロップのセットアップ
 */
let draggedIndex: number | null = null;

function setupDragAndDrop(selectedList: HTMLDivElement): void {
  selectedList.addEventListener("dragstart", (e) => {
    const item = (e.target as HTMLElement).closest(".selected-item");
    if (!item) return;

    draggedIndex = Number.parseInt(item.getAttribute("data-index") || "0", 10);
    item.classList.add("dragging");
  });

  selectedList.addEventListener("dragend", (e) => {
    const item = (e.target as HTMLElement).closest(".selected-item");
    if (item) {
      item.classList.remove("dragging");
    }
    draggedIndex = null;

    // すべての drag-over クラスを削除
    for (const el of selectedList.querySelectorAll(".drag-over")) {
      el.classList.remove("drag-over");
    }
  });

  selectedList.addEventListener("dragover", (e) => {
    e.preventDefault();
    const item = (e.target as HTMLElement).closest(".selected-item");
    if (!item || draggedIndex === null) return;

    const targetIndex = Number.parseInt(
      item.getAttribute("data-index") || "0",
      10,
    );
    if (targetIndex !== draggedIndex) {
      item.classList.add("drag-over");
    }
  });

  selectedList.addEventListener("dragleave", (e) => {
    const item = (e.target as HTMLElement).closest(".selected-item");
    if (item) {
      item.classList.remove("drag-over");
    }
  });

  selectedList.addEventListener("drop", (e) => {
    e.preventDefault();
    const item = (e.target as HTMLElement).closest(".selected-item");
    if (!item || draggedIndex === null) return;

    const targetIndex = Number.parseInt(
      item.getAttribute("data-index") || "0",
      10,
    );

    if (targetIndex !== draggedIndex) {
      // 要素を入れ替え
      const [moved] = selectedEntries.splice(draggedIndex, 1);
      selectedEntries.splice(targetIndex, 0, moved);
      renderSelectedList();
    }
  });
}

/**
 * ステータス表示
 */
function showStatus(
  statusDiv: HTMLDivElement,
  type: "success" | "error" | "loading",
  message: string,
): void {
  statusDiv.className = type;
  statusDiv.innerHTML = message;
}

/**
 * デプロイ処理
 */
async function handleDeploy(
  els: TocElements,
  provider: DeployProvider,
): Promise<void> {
  const title = els.tocTitle.value.trim() || "Table of Contents";

  if (selectedEntries.length === 0) {
    showStatus(els.status, "error", "Please select at least one page.");
    return;
  }

  els.btnDeploy.disabled = true;
  showStatus(els.status, "loading", "Generating TOC...");

  // TOC HTML を生成
  const tocHtml = generateTocHtml(title, selectedEntries);

  // デプロイ
  const config = DEPLOY_CONFIGS[provider];
  const result = await config
    .getCredentials()
    .andThen(({ token, accountId }) =>
      config.deploy(token, accountId, tocHtml, (msg) =>
        showStatus(els.status, "loading", msg),
      ),
    );

  await result.match(
    async (url) => {
      // 履歴に保存
      await addDeployHistory({
        title: `TOC: ${title}`,
        url,
        provider,
        contentType: "html",
      });

      showStatus(
        els.status,
        "success",
        `Success! <a href="${url}" target="_blank">${url}</a>`,
      );

      // クリップボードにコピー
      await navigator.clipboard.writeText(url);

      // 新しいタブで開く
      chrome.tabs.create({ url, active: true });
    },
    async (error) => {
      showStatus(els.status, "error", `Error: ${error.message}`);
    },
  );

  els.btnDeploy.disabled = selectedEntries.length === 0;
}

/**
 * 初期化
 */
document.addEventListener("DOMContentLoaded", async () => {
  elements = getElements();
  if (!elements) return;

  const els = elements;

  // デフォルトプロバイダーを取得
  const provider = await getDefaultProvider();

  // 履歴を取得して描画
  allHistory = await getDeployHistory();
  renderHistoryList();
  renderSelectedList();

  // 履歴リストのクリックイベント
  els.historyList.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const item = target.closest(".history-item");
    if (!item) return;

    const url = item.getAttribute("data-url") || "";
    const title = item.getAttribute("data-title") || "";

    toggleEntry({ title, url });
  });

  // 選択済みリストのクリックイベント（削除ボタン）
  els.selectedList.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains("btn-remove")) {
      const item = target.closest(".selected-item");
      if (item) {
        const url = item.getAttribute("data-url") || "";
        removeEntry(url);
      }
    }
  });

  // ドラッグ&ドロップのセットアップ
  setupDragAndDrop(els.selectedList);

  // 検索
  els.searchInput.addEventListener("input", () => {
    renderHistoryList(els.searchInput.value);
  });

  // デプロイボタン
  els.btnDeploy.addEventListener("click", () => {
    handleDeploy(els, provider);
  });
});
