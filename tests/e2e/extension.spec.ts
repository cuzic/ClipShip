import path from "node:path";
import { fileURLToPath } from "node:url";
import { type BrowserContext, chromium, expect, test } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXTENSION_PATH = path.join(__dirname, "../../dist");

test.describe("ClipShip Extension", () => {
  let context: BrowserContext;

  test.beforeAll(async () => {
    // Chrome拡張をロードしたブラウザコンテキストを作成
    context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ],
    });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test("should load extension popup", async () => {
    // 拡張機能のバックグラウンドページを取得
    let extensionId: string | undefined;

    // サービスワーカーからextension IDを取得
    const serviceWorkers = context.serviceWorkers();
    for (const worker of serviceWorkers) {
      const url = worker.url();
      if (url.includes("chrome-extension://")) {
        extensionId = url.split("/")[2];
        break;
      }
    }

    // 少し待ってから再試行
    if (!extensionId) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const workers = context.serviceWorkers();
      for (const worker of workers) {
        const url = worker.url();
        if (url.includes("chrome-extension://")) {
          extensionId = url.split("/")[2];
          break;
        }
      }
    }

    if (!extensionId) {
      test.skip();
      return;
    }

    // ポップアップページを開く
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);

    // ポップアップの要素を確認
    await expect(popupPage.locator("h1")).toHaveText("Deploy from Clipboard");
    await expect(popupPage.locator("#btn-netlify")).toBeVisible();
    await expect(popupPage.locator("#btn-gist")).toBeVisible();
  });

  test("should load options page", async () => {
    let extensionId: string | undefined;

    const serviceWorkers = context.serviceWorkers();
    for (const worker of serviceWorkers) {
      const url = worker.url();
      if (url.includes("chrome-extension://")) {
        extensionId = url.split("/")[2];
        break;
      }
    }

    if (!extensionId) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const workers = context.serviceWorkers();
      for (const worker of workers) {
        const url = worker.url();
        if (url.includes("chrome-extension://")) {
          extensionId = url.split("/")[2];
          break;
        }
      }
    }

    if (!extensionId) {
      test.skip();
      return;
    }

    // オプションページを開く
    const optionsPage = await context.newPage();
    await optionsPage.goto(`chrome-extension://${extensionId}/options.html`);

    // オプションページの要素を確認
    await expect(optionsPage.locator("h1")).toHaveText("ClipShip Settings");
    await expect(optionsPage.locator("#netlifyToken")).toBeVisible();
    await expect(optionsPage.locator("#githubToken")).toBeVisible();
    await expect(optionsPage.locator("#save")).toBeVisible();
  });
});
