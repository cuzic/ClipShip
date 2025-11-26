/**
 * Chrome Storage ヘルパー
 * トークンの保存・取得を行う
 */

type StorageKeys = "netlifyToken" | "githubToken" | "netlifySiteId";

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
