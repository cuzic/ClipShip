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

    test("should have PasteHost Page as title", () => {
      const content = "<div>test</div>";
      const result = processContent(content);

      expect(result.content).toContain("<title>PasteHost Page</title>");
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

  describe("KaTeX 数式処理", () => {
    test("should render inline math with $...$", () => {
      const content = "# Math\n\nInline: $E = mc^2$";
      const result = processContent(content);

      expect(result.content).toContain("katex");
      expect(result.content).toContain("katex.min.css");
    });

    test("should render display math with $$...$$", () => {
      const content = "# Math\n\n$$\\sum_{i=1}^{n} x_i$$";
      const result = processContent(content);

      expect(result.content).toContain("katex");
    });

    test("should include KaTeX CSS in Markdown output", () => {
      const content = "# Test\n\nSome text";
      const result = processContent(content);

      expect(result.content).toContain("katex.min.css");
    });
  });

  describe("タスクリスト処理", () => {
    test("should render unchecked task list items", () => {
      const content = "# Tasks\n\n- [ ] Todo item";
      const result = processContent(content);

      expect(result.content).toContain('type="checkbox"');
      expect(result.content).not.toContain("checked");
    });

    test("should render checked task list items", () => {
      const content = "# Tasks\n\n- [x] Done item";
      const result = processContent(content);

      expect(result.content).toContain('type="checkbox"');
      expect(result.content).toContain("checked");
    });

    test("should render mixed task list", () => {
      const content = "# Tasks\n\n- [x] Done\n- [ ] Todo\n- [x] Also done";
      const result = processContent(content);

      const checkboxMatches = result.content.match(/type="checkbox"/g);
      // 3 task items, each with checkbox (labelAfter option creates additional elements)
      expect(checkboxMatches?.length).toBeGreaterThanOrEqual(3);
    });

    test("should include task list styles", () => {
      const content = "# Test\n\nSome text";
      const result = processContent(content);

      expect(result.content).toContain("task-list-item");
    });
  });

  describe("脚注処理", () => {
    test("should render footnote reference", () => {
      const content =
        "# Article\n\nThis is text[^1].\n\n[^1]: Footnote content";
      const result = processContent(content);

      expect(result.content).toContain("footnote");
    });

    test("should include footnote styles", () => {
      const content = "# Test\n\nSome text";
      const result = processContent(content);

      expect(result.content).toContain(".footnotes");
    });
  });

  describe("Emoji 処理", () => {
    test("should convert emoji shortcodes to unicode", () => {
      const content = "# Emoji\n\n:smile: :heart:";
      const result = processContent(content);

      // Emoji should be converted to unicode characters
      expect(result.content).toContain("😄");
      expect(result.content).toContain("❤️");
    });

    test("should keep unknown shortcodes as-is", () => {
      const content = "# Test\n\n:unknown_emoji_code:";
      const result = processContent(content);

      expect(result.content).toContain(":unknown_emoji_code:");
    });
  });

  describe("取り消し線処理", () => {
    test("should render strikethrough with ~~text~~", () => {
      const content = "# Test\n\n~~strikethrough text~~";
      const result = processContent(content);

      expect(result.content).toContain("<s>");
      expect(result.content).toContain("</s>");
    });

    test("should include strikethrough styles", () => {
      const content = "# Test\n\nSome text";
      const result = processContent(content);

      expect(result.content).toContain("text-decoration: line-through");
    });
  });
});
