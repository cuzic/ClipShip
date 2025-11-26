import { describe, expect, test } from "bun:test";
import { createHtml } from "../../src/lib/html";

describe("createHtml", () => {
  test("should wrap content in valid HTML structure", () => {
    const content = "<h1>Hello World</h1>";
    const result = createHtml(content);

    expect(result).toContain("<!DOCTYPE html>");
    expect(result).toContain('<html lang="ja">');
    expect(result).toContain('<meta charset="UTF-8">');
    expect(result).toContain('<meta name="viewport"');
    expect(result).toContain("<body>");
    expect(result).toContain("</body>");
    expect(result).toContain("</html>");
  });

  test("should include the content in body", () => {
    const content = "<p>Test content</p>";
    const result = createHtml(content);

    expect(result).toContain(content);
  });

  test("should handle empty content", () => {
    const result = createHtml("");

    expect(result).toContain("<!DOCTYPE html>");
    expect(result).toContain("<body>");
  });

  test("should handle multiline content", () => {
    const content = `<div>
  <h1>Title</h1>
  <p>Paragraph</p>
</div>`;
    const result = createHtml(content);

    expect(result).toContain(content);
  });

  test("should have ClipShip Page as title", () => {
    const result = createHtml("test");

    expect(result).toContain("<title>ClipShip Page</title>");
  });
});
