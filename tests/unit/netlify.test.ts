/**
 * Netlify スキーマのテスト
 */
import { describe, expect, test } from "bun:test";
import { NetlifySiteSchema } from "@/schemas/netlify";

describe("NetlifySiteSchema", () => {
  test("有効な Netlify サイトレスポンスをパース", () => {
    const response = {
      id: "site-123",
      name: "pastehost-abc123",
      url: "https://pastehost-abc123.netlify.app",
      ssl_url: "https://pastehost-abc123.netlify.app",
      admin_url: "https://app.netlify.com/sites/pastehost-abc123",
    };

    const result = NetlifySiteSchema.parse(response);
    expect(result.id).toBe("site-123");
    expect(result.name).toBe("pastehost-abc123");
    expect(result.url).toBe("https://pastehost-abc123.netlify.app");
    expect(result.ssl_url).toBe("https://pastehost-abc123.netlify.app");
    expect(result.admin_url).toBe(
      "https://app.netlify.com/sites/pastehost-abc123",
    );
  });

  test("最小限のフィールドでパース", () => {
    const response = {
      id: "site-456",
      name: "my-site",
      url: "https://my-site.netlify.app",
    };

    const result = NetlifySiteSchema.parse(response);
    expect(result.id).toBe("site-456");
    expect(result.name).toBe("my-site");
    expect(result.url).toBe("https://my-site.netlify.app");
    expect(result.ssl_url).toBeUndefined();
    expect(result.admin_url).toBeUndefined();
  });

  test("ssl_url がない場合", () => {
    const response = {
      id: "site-789",
      name: "http-only-site",
      url: "http://http-only-site.netlify.app",
      admin_url: "https://app.netlify.com/sites/http-only-site",
    };

    const result = NetlifySiteSchema.parse(response);
    expect(result.ssl_url).toBeUndefined();
  });

  test("必須フィールドが欠けているとエラー", () => {
    const response = {
      id: "site-123",
      // name が欠けている
      url: "https://example.netlify.app",
    };

    expect(() => NetlifySiteSchema.parse(response)).toThrow();
  });

  test("id が欠けているとエラー", () => {
    const response = {
      name: "my-site",
      url: "https://my-site.netlify.app",
    };

    expect(() => NetlifySiteSchema.parse(response)).toThrow();
  });

  test("url が欠けているとエラー", () => {
    const response = {
      id: "site-123",
      name: "my-site",
    };

    expect(() => NetlifySiteSchema.parse(response)).toThrow();
  });
});
