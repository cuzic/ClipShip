import { describe, expect, test } from "bun:test";
import { convertToGistHackUrl } from "../../src/lib/gist";

describe("convertToGistHackUrl", () => {
  test("should convert gist.githubusercontent.com to gist.githack.com", () => {
    const rawUrl =
      "https://gist.githubusercontent.com/user/abc123/raw/def456/index.html";
    const result = convertToGistHackUrl(rawUrl);

    expect(result).toBe(
      "https://gist.githack.com/user/abc123/raw/def456/index.html",
    );
  });

  test("should handle different usernames and IDs", () => {
    const rawUrl =
      "https://gist.githubusercontent.com/octocat/1234567890abcdef/raw/fedcba0987654321/index.html";
    const result = convertToGistHackUrl(rawUrl);

    expect(result).toBe(
      "https://gist.githack.com/octocat/1234567890abcdef/raw/fedcba0987654321/index.html",
    );
  });

  test("should not modify URLs that don't contain gist.githubusercontent.com", () => {
    const url = "https://example.com/path/to/file";
    const result = convertToGistHackUrl(url);

    expect(result).toBe(url);
  });

  test("should only replace the domain part", () => {
    const rawUrl =
      "https://gist.githubusercontent.com/user/id/raw/hash/gist.githubusercontent.com.html";
    const result = convertToGistHackUrl(rawUrl);

    expect(result).toBe(
      "https://gist.githack.com/user/id/raw/hash/gist.githubusercontent.com.html",
    );
  });
});
