/**
 * Chrome Storage ヘルパー
 * トークンの保存・取得を行う
 */

/**
 * デプロイプロバイダーの種類
 */
export type DeployProvider = "netlify" | "vercel" | "cloudflare" | "gist";

/**
 * ストレージキーの型
 */
type StorageKeys =
  | "netlifyToken"
  | "githubToken"
  | "netlifySiteId"
  | "vercelToken"
  | "vercelProjectId"
  | "cloudflareToken"
  | "cloudflareAccountId"
  | "cloudflareProjectId"
  | "defaultProvider";

/**
 * ストレージからデータを取得する
 */
export function getStorageData(key: StorageKeys): Promise<string | undefined> {
  return new Promise((resolve) => {
    chrome.storage.sync.get([key], (result) => {
      resolve(result[key] as string | undefined);
    });
  });
}

/**
 * ストレージにデータを保存する
 */
export function setStorageData(key: StorageKeys, value: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ [key]: value }, () => {
      resolve();
    });
  });
}

/**
 * 複数のデータをストレージに保存する
 */
export function setMultipleStorageData(
  data: Partial<Record<StorageKeys, string>>,
): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set(data, () => {
      resolve();
    });
  });
}

/**
 * 複数のデータをストレージから取得する
 */
export function getMultipleStorageData(
  keys: StorageKeys[],
): Promise<Partial<Record<StorageKeys, string>>> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(keys, (result) => {
      resolve(result as Partial<Record<StorageKeys, string>>);
    });
  });
}

/**
 * デフォルトのデプロイプロバイダーを取得
 */
export async function getDefaultProvider(): Promise<DeployProvider> {
  const provider = await getStorageData("defaultProvider");
  return (provider as DeployProvider) || "netlify";
}

/**
 * デフォルトのデプロイプロバイダーを設定
 */
export function setDefaultProvider(provider: DeployProvider): Promise<void> {
  return setStorageData("defaultProvider", provider);
}

/**
 * デプロイ履歴のエントリ
 */
export interface DeployHistoryEntry {
  id: string;
  title: string;
  url: string;
  provider: DeployProvider;
  deployedAt: string; // ISO 8601 形式
  contentType: "html" | "markdown" | "text";
}

/**
 * 履歴の最大保存件数
 */
const MAX_HISTORY_ENTRIES = 100;

/**
 * デプロイ履歴を取得
 */
export function getDeployHistory(): Promise<DeployHistoryEntry[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["deployHistory"], (result) => {
      resolve((result.deployHistory as DeployHistoryEntry[]) || []);
    });
  });
}

/**
 * デプロイ履歴に追加
 */
export async function addDeployHistory(
  entry: Omit<DeployHistoryEntry, "id" | "deployedAt">,
): Promise<DeployHistoryEntry> {
  const history = await getDeployHistory();

  const newEntry: DeployHistoryEntry = {
    ...entry,
    id: crypto.randomUUID(),
    deployedAt: new Date().toISOString(),
  };

  // 先頭に追加し、最大件数を超えたら古いものを削除
  const updatedHistory = [newEntry, ...history].slice(0, MAX_HISTORY_ENTRIES);

  return new Promise((resolve) => {
    chrome.storage.local.set({ deployHistory: updatedHistory }, () => {
      resolve(newEntry);
    });
  });
}

/**
 * デプロイ履歴のタイトルを更新
 */
export async function updateDeployHistoryTitle(
  id: string,
  title: string,
): Promise<void> {
  const history = await getDeployHistory();
  const updatedHistory = history.map((entry) =>
    entry.id === id ? { ...entry, title } : entry,
  );

  return new Promise((resolve) => {
    chrome.storage.local.set({ deployHistory: updatedHistory }, () => {
      resolve();
    });
  });
}

/**
 * デプロイ履歴から削除
 */
export async function deleteDeployHistory(id: string): Promise<void> {
  const history = await getDeployHistory();
  const updatedHistory = history.filter((entry) => entry.id !== id);

  return new Promise((resolve) => {
    chrome.storage.local.set({ deployHistory: updatedHistory }, () => {
      resolve();
    });
  });
}

/**
 * デプロイ履歴をすべて削除
 */
export function clearDeployHistory(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ deployHistory: [] }, () => {
      resolve();
    });
  });
}
