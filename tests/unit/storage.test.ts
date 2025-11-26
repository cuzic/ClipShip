/**
 * Chrome Storage のテスト
 * sinon-chrome を使用してモック
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import chrome from "sinon-chrome";
import {
  getMultipleStorageData,
  getStorageData,
  setMultipleStorageData,
  setStorageData,
} from "@/lib/storage";

// グローバルに chrome をセット
declare global {
  var chrome: typeof import("sinon-chrome");
}

describe("Chrome Storage", () => {
  beforeEach(() => {
    globalThis.chrome = chrome;
    chrome.storage.sync.get.flush();
    chrome.storage.sync.set.flush();
  });

  afterEach(() => {
    chrome.reset();
  });

  describe("getStorageData", () => {
    test("保存されたデータを取得", async () => {
      chrome.storage.sync.get.yields({ netlifyToken: "test-token" });

      const result = await getStorageData("netlifyToken");
      expect(result).toBe("test-token");
      expect(chrome.storage.sync.get.calledOnce).toBe(true);
      expect(chrome.storage.sync.get.calledWith(["netlifyToken"])).toBe(true);
    });

    test("存在しないキーは undefined を返す", async () => {
      chrome.storage.sync.get.yields({});

      const result = await getStorageData("netlifyToken");
      expect(result).toBeUndefined();
    });

    test("githubToken を取得", async () => {
      chrome.storage.sync.get.yields({ githubToken: "github-token-123" });

      const result = await getStorageData("githubToken");
      expect(result).toBe("github-token-123");
    });

    test("netlifySiteId を取得", async () => {
      chrome.storage.sync.get.yields({ netlifySiteId: "site-id-456" });

      const result = await getStorageData("netlifySiteId");
      expect(result).toBe("site-id-456");
    });
  });

  describe("setStorageData", () => {
    test("データを保存", async () => {
      chrome.storage.sync.set.yields();

      await setStorageData("netlifyToken", "new-token");
      expect(chrome.storage.sync.set.calledOnce).toBe(true);
      expect(
        chrome.storage.sync.set.calledWith({ netlifyToken: "new-token" })
      ).toBe(true);
    });

    test("githubToken を保存", async () => {
      chrome.storage.sync.set.yields();

      await setStorageData("githubToken", "new-github-token");
      expect(
        chrome.storage.sync.set.calledWith({ githubToken: "new-github-token" })
      ).toBe(true);
    });

    test("netlifySiteId を保存", async () => {
      chrome.storage.sync.set.yields();

      await setStorageData("netlifySiteId", "new-site-id");
      expect(
        chrome.storage.sync.set.calledWith({ netlifySiteId: "new-site-id" })
      ).toBe(true);
    });
  });

  describe("getMultipleStorageData", () => {
    test("複数のデータを取得", async () => {
      chrome.storage.sync.get.yields({
        netlifyToken: "netlify-123",
        githubToken: "github-456",
      });

      const result = await getMultipleStorageData([
        "netlifyToken",
        "githubToken",
      ]);
      expect(result.netlifyToken).toBe("netlify-123");
      expect(result.githubToken).toBe("github-456");
    });

    test("一部のキーのみ存在する場合", async () => {
      chrome.storage.sync.get.yields({
        netlifyToken: "netlify-only",
      });

      const result = await getMultipleStorageData([
        "netlifyToken",
        "githubToken",
      ]);
      expect(result.netlifyToken).toBe("netlify-only");
      expect(result.githubToken).toBeUndefined();
    });

    test("空の結果", async () => {
      chrome.storage.sync.get.yields({});

      const result = await getMultipleStorageData([
        "netlifyToken",
        "githubToken",
      ]);
      expect(result.netlifyToken).toBeUndefined();
      expect(result.githubToken).toBeUndefined();
    });
  });

  describe("setMultipleStorageData", () => {
    test("複数のデータを保存", async () => {
      chrome.storage.sync.set.yields();

      await setMultipleStorageData({
        netlifyToken: "netlify-new",
        githubToken: "github-new",
      });

      expect(chrome.storage.sync.set.calledOnce).toBe(true);
      expect(
        chrome.storage.sync.set.calledWith({
          netlifyToken: "netlify-new",
          githubToken: "github-new",
        })
      ).toBe(true);
    });

    test("部分的なデータを保存", async () => {
      chrome.storage.sync.set.yields();

      await setMultipleStorageData({
        netlifyToken: "only-netlify",
      });

      expect(
        chrome.storage.sync.set.calledWith({
          netlifyToken: "only-netlify",
        })
      ).toBe(true);
    });
  });
});
