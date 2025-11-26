/**
 * Gist スキーマのテスト
 */
import { describe, expect, test } from "bun:test";
import { GistResponseSchema } from "@/schemas/gist";

describe("GistResponseSchema", () => {
  test("有効な Gist レスポンスをパース", () => {
    const response = {
      id: "abc123",
      node_id: "G_abc123",
      url: "https://api.github.com/gists/abc123",
      html_url: "https://gist.github.com/abc123",
      files: {
        "index.html": {
          filename: "index.html",
          type: "text/html",
          language: "HTML",
          raw_url:
            "https://gist.githubusercontent.com/user/abc123/raw/xyz/index.html",
          size: 1234,
        },
      },
      public: true,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      description: "Test gist",
      comments: 0,
      owner: {
        login: "testuser",
        id: 12345,
      },
    };

    const result = GistResponseSchema.parse(response);
    expect(result.id).toBe("abc123");
    expect(result.html_url).toBe("https://gist.github.com/abc123");
    expect(result.files["index.html"]?.raw_url).toContain(
      "gist.githubusercontent.com",
    );
  });

  test("最小限のフィールドでパース", () => {
    const response = {
      id: "abc123",
      url: "https://api.github.com/gists/abc123",
      html_url: "https://gist.github.com/abc123",
      files: {},
      public: true,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      description: null,
    };

    const result = GistResponseSchema.parse(response);
    expect(result.id).toBe("abc123");
    expect(result.description).toBeNull();
  });

  test("null の owner を許容", () => {
    const response = {
      id: "abc123",
      url: "https://api.github.com/gists/abc123",
      html_url: "https://gist.github.com/abc123",
      files: {},
      public: true,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      description: null,
      owner: null,
    };

    const result = GistResponseSchema.parse(response);
    expect(result.owner).toBeNull();
  });

  test("null のファイル内容を許容", () => {
    const response = {
      id: "abc123",
      url: "https://api.github.com/gists/abc123",
      html_url: "https://gist.github.com/abc123",
      files: {
        "deleted.txt": null,
      },
      public: true,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      description: null,
    };

    const result = GistResponseSchema.parse(response);
    expect(result.files["deleted.txt"]).toBeNull();
  });

  test("複数ファイルの Gist をパース", () => {
    const response = {
      id: "abc123",
      url: "https://api.github.com/gists/abc123",
      html_url: "https://gist.github.com/abc123",
      files: {
        "index.html": {
          filename: "index.html",
          raw_url: "https://gist.githubusercontent.com/user/abc/raw/index.html",
        },
        "style.css": {
          filename: "style.css",
          raw_url: "https://gist.githubusercontent.com/user/abc/raw/style.css",
        },
        "script.js": {
          filename: "script.js",
          raw_url: "https://gist.githubusercontent.com/user/abc/raw/script.js",
        },
      },
      public: true,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      description: "Multi-file gist",
    };

    const result = GistResponseSchema.parse(response);
    expect(Object.keys(result.files)).toHaveLength(3);
    expect(result.files["index.html"]?.filename).toBe("index.html");
    expect(result.files["style.css"]?.filename).toBe("style.css");
    expect(result.files["script.js"]?.filename).toBe("script.js");
  });

  test("必須フィールドが欠けているとエラー", () => {
    const response = {
      id: "abc123",
      // url が欠けている
      html_url: "https://gist.github.com/abc123",
      files: {},
      public: true,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      description: null,
    };

    expect(() => GistResponseSchema.parse(response)).toThrow();
  });
});
