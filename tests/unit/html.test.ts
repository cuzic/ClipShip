import { describe, expect, test } from "bun:test";
import { processContent } from "@/lib/html";

describe("processContent", () => {
  describe("HTML フラグメント処理", () => {
    test("should wrap HTML fragment in valid HTML structure", () => {
      const content = "<h1>Hello World</h1>";
      const result = processContent(content);

      expect(result.content).toContain("<!DOCTYPE html>");
      expect(result.content).toContain('<html lang="ja">');
      expect(result.content).toContain('<meta charset="UTF-8">');
      expect(result.content).toContain('<meta name="viewport"');
      expect(result.content).toContain("<body>");
      expect(result.content).toContain("</body>");
      expect(result.content).toContain("</html>");
    });

    test("should include the content in body", () => {
      const content = "<p>Test content</p>";
      const result = processContent(content);

      expect(result.content).toContain(content);
    });

    test("should handle multiline content", () => {
      const content = `<div>
  <h1>Title</h1>
  <p>Paragraph</p>
</div>`;
      const result = processContent(content);

      expect(result.content).toContain(content);
    });

    test("should have ClipShip Page as title", () => {
      const content = "<div>test</div>";
      const result = processContent(content);

      expect(result.content).toContain("<title>ClipShip Page</title>");
    });
  });

  describe("完全な HTML ドキュメント処理", () => {
    test("should return complete HTML document as-is", () => {
      const content =
        "<!DOCTYPE html><html><head></head><body>Hello</body></html>";
      const result = processContent(content);

      expect(result.content).toBe(content);
      expect(result.contentInfo.type).toBe("html");
    });

    test("should detect <html> tag at start", () => {
      const content = "<html><body>Test</body></html>";
      const result = processContent(content);

      expect(result.content).toBe(content);
    });
  });

  describe("出力形式", () => {
    test("should always return HTML file info", () => {
      const result = processContent("<div>Test</div>");

      expect(result.filename).toBe("index.html");
      expect(result.mimeType).toBe("text/html");
    });
  });
});
