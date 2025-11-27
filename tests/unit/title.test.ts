/**
 * タイトル抽出モジュールのテスト
 */
import { describe, expect, test } from "bun:test";
import { extractTitle } from "@/lib/title";

describe("extractTitle", () => {
  describe("HTML コンテンツ", () => {
    test("should extract title from <title> tag", () => {
      const content = `<!DOCTYPE html>
<html>
<head><title>My Page Title</title></head>
<body><h1>Heading</h1></body>
</html>`;
      const result = extractTitle(content, "html");
      expect(result).toBe("My Page Title");
    });

    test("should extract title from <h1> when no <title>", () => {
      const content = "<div><h1>Main Heading</h1><p>Content</p></div>";
      const result = extractTitle(content, "html");
      expect(result).toBe("Main Heading");
    });

    test("should fallback to default when no title or h1", () => {
      const content = "<div><p>Just some content</p></div>";
      const result = extractTitle(content, "html");
      // Default format: YYYY-MM-DD HH:MM
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });
  });

  describe("Markdown コンテンツ", () => {
    test("should extract title from # heading", () => {
      const content = "# My Document\n\nSome content here";
      const result = extractTitle(content, "markdown");
      expect(result).toBe("My Document");
    });

    test("should extract title from ## heading if no #", () => {
      const content = "## Second Level Heading\n\nContent";
      const result = extractTitle(content, "markdown");
      expect(result).toBe("Second Level Heading");
    });

    test("should fallback to default when no heading", () => {
      const content = "Just plain text without headings";
      const result = extractTitle(content, "markdown");
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });

    test("should skip empty lines before heading", () => {
      const content = "\n\n# Title After Empty Lines\n\nContent";
      const result = extractTitle(content, "markdown");
      expect(result).toBe("Title After Empty Lines");
    });
  });

  describe("プレーンテキストコンテンツ", () => {
    test("should use first line as title", () => {
      const content = "First Line Title\nSecond line\nThird line";
      const result = extractTitle(content, "text");
      expect(result).toBe("First Line Title");
    });

    test("should skip empty lines", () => {
      const content = "\n\nActual First Line\nSecond line";
      const result = extractTitle(content, "text");
      expect(result).toBe("Actual First Line");
    });

    test("should fallback to default for empty content", () => {
      const content = "   \n  \n   ";
      const result = extractTitle(content, "text");
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });
  });

  describe("タイトルの切り詰め", () => {
    test("should truncate long titles", () => {
      const longTitle = "A".repeat(150);
      const content = `# ${longTitle}\n\nContent`;
      const result = extractTitle(content, "markdown");
      expect(result.length).toBeLessThanOrEqual(100);
      expect(result).toEndWith("...");
    });

    test("should not truncate short titles", () => {
      const content = "# Short Title\n\nContent";
      const result = extractTitle(content, "markdown");
      expect(result).toBe("Short Title");
      expect(result).not.toContain("...");
    });
  });
});
