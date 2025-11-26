import { describe, expect, test } from "bun:test";
import { detectContentType } from "@/lib/detect";

describe("detectContentType", () => {
  describe("HTML detection", () => {
    test("detects DOCTYPE html", () => {
      const content = "<!DOCTYPE html><html><body>Hello</body></html>";
      const result = detectContentType(content);
      expect(result.type).toBe("html");
      expect(result.extension).toBe("html");
      expect(result.mimeType).toBe("text/html");
    });

    test("detects lowercase doctype", () => {
      const content = "<!doctype html><html><body>Hello</body></html>";
      const result = detectContentType(content);
      expect(result.type).toBe("html");
    });

    test("detects <html> tag", () => {
      const content = "<html><head></head><body>Hello</body></html>";
      const result = detectContentType(content);
      expect(result.type).toBe("html");
    });

    test("detects HTML tags in content", () => {
      const content = "<div class='container'><p>Hello World</p></div>";
      const result = detectContentType(content);
      expect(result.type).toBe("html");
    });

    test("detects various HTML tags", () => {
      expect(
        detectContentType("<table><tr><td>data</td></tr></table>").type,
      ).toBe("html");
      expect(detectContentType("<form><input type='text'></form>").type).toBe(
        "html",
      );
      expect(detectContentType("<ul><li>item</li></ul>").type).toBe("html");
      expect(detectContentType("<h1>Title</h1>").type).toBe("html");
      expect(detectContentType("<a href='#'>Link</a>").type).toBe("html");
      expect(detectContentType("<img src='test.png'>").type).toBe("html");
    });
  });

  describe("Markdown detection", () => {
    test("detects headings", () => {
      const content = "# Title\n\nSome content here.";
      const result = detectContentType(content);
      expect(result.type).toBe("markdown");
      expect(result.extension).toBe("md");
      expect(result.mimeType).toBe("text/markdown");
    });

    test("detects multiple heading levels", () => {
      const content = "## Subtitle\n### Another level";
      const result = detectContentType(content);
      expect(result.type).toBe("markdown");
    });

    test("detects unordered lists", () => {
      const content = "- Item 1\n- Item 2\n- Item 3";
      const result = detectContentType(content);
      expect(result.type).toBe("markdown");
    });

    test("detects ordered lists", () => {
      const content = "1. First\n2. Second\n3. Third";
      const result = detectContentType(content);
      expect(result.type).toBe("markdown");
    });

    test("detects code blocks", () => {
      const content = "```javascript\nconst x = 1;\n```";
      const result = detectContentType(content);
      expect(result.type).toBe("markdown");
    });

    test("detects links", () => {
      const content =
        "Check out [this link](https://example.com) for more info.";
      const result = detectContentType(content);
      expect(result.type).toBe("markdown");
    });

    test("detects images", () => {
      const content = "![Alt text](image.png)";
      const result = detectContentType(content);
      expect(result.type).toBe("markdown");
    });

    test("detects bold text", () => {
      const content = "This is **bold** text and more content here.";
      const result = detectContentType(content);
      expect(result.type).toBe("markdown");
    });

    test("detects inline code", () => {
      const content = "Use the `console.log` function to debug.";
      const result = detectContentType(content);
      expect(result.type).toBe("markdown");
    });

    test("detects blockquotes", () => {
      const content = "> This is a quote\n> Another line";
      const result = detectContentType(content);
      expect(result.type).toBe("markdown");
    });

    test("detects complex markdown", () => {
      const content = `# README

## Installation

\`\`\`bash
npm install package
\`\`\`

## Usage

- Step 1
- Step 2

See [documentation](https://example.com) for details.
`;
      const result = detectContentType(content);
      expect(result.type).toBe("markdown");
    });
  });

  describe("Plain text detection", () => {
    test("detects plain text", () => {
      const content = "This is just plain text without any markup.";
      const result = detectContentType(content);
      expect(result.type).toBe("text");
      expect(result.extension).toBe("txt");
      expect(result.mimeType).toBe("text/plain");
    });

    test("detects multiline plain text", () => {
      const content = "Line 1\nLine 2\nLine 3";
      const result = detectContentType(content);
      expect(result.type).toBe("text");
    });

    test("does not mistake # in middle of text for heading", () => {
      const content = "Price is $100 # good deal";
      const result = detectContentType(content);
      expect(result.type).toBe("text");
    });
  });

  describe("Edge cases", () => {
    test("handles empty string", () => {
      const result = detectContentType("");
      expect(result.type).toBe("text");
    });

    test("handles whitespace only", () => {
      const result = detectContentType("   \n\t  ");
      expect(result.type).toBe("text");
    });

    test("HTML takes precedence over markdown-like content", () => {
      const content =
        "<!DOCTYPE html><html><body># Not a heading</body></html>";
      const result = detectContentType(content);
      expect(result.type).toBe("html");
    });
  });
});
