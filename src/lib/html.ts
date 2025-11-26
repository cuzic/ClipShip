/**
 * HTML テンプレート生成モジュール
 * クリップボードのテキストを完全なHTML構造に埋め込む
 */

// @ts-expect-error: No type definitions available
import markdownItKatex from "@iktakahiro/markdown-it-katex";
import MarkdownIt from "markdown-it";
// @ts-expect-error: No type definitions available
import markdownItTaskLists from "markdown-it-task-lists";
import { type ContentInfo, detectContentType } from "./detect";

export interface ProcessedContent {
  content: string;
  filename: string;
  mimeType: string;
  contentInfo: ContentInfo;
}

/**
 * HTML が完全なドキュメントかどうかを判定
 */
function isCompleteHtmlDocument(content: string): boolean {
  const trimmed = content.trim().toLowerCase();
  return trimmed.startsWith("<!doctype") || trimmed.startsWith("<html");
}

/**
 * HTML コンテンツを処理
 * - 完全な HTML ドキュメントならそのまま
 * - フラグメントなら HTML テンプレートで包む
 */
function processHtml(content: string): string {
  if (isCompleteHtmlDocument(content)) {
    return content;
  }

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ClipShip Page</title>
</head>
<body>
${content}
</body>
</html>`;
}

/**
 * highlight.js CDN (シンタックスハイライト)
 */
const HIGHLIGHT_JS_CDN = `
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11/styles/github.min.css">
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/core.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/languages/javascript.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/languages/typescript.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/languages/python.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/languages/java.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/languages/sql.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/languages/bash.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/languages/json.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/languages/yaml.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/languages/xml.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/languages/css.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/languages/markdown.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/languages/go.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/languages/rust.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/languages/ruby.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/languages/php.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/languages/c.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/languages/cpp.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/languages/csharp.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/languages/kotlin.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/languages/swift.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/languages/dockerfile.min.js"></script>
<script>hljs.highlightAll();</script>
`;

/**
 * KaTeX CDN (数式レンダリング)
 */
const KATEX_CDN = `
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.css">
`;

/**
 * Markdown スタイル
 */
const MARKDOWN_STYLES = `
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11/styles/github.min.css">
${KATEX_CDN}
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    line-height: 1.6;
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    color: #333;
  }
  pre {
    background: #f6f8fa;
    padding: 16px;
    overflow-x: auto;
    border-radius: 6px;
  }
  code {
    background: #f6f8fa;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 0.9em;
  }
  pre code {
    background: none;
    padding: 0;
  }
  blockquote {
    border-left: 4px solid #ddd;
    margin: 0;
    padding-left: 16px;
    color: #666;
  }
  img {
    max-width: 100%;
  }
  table {
    border-collapse: collapse;
    width: 100%;
  }
  th, td {
    border: 1px solid #ddd;
    padding: 8px;
    text-align: left;
  }
  th {
    background: #f4f4f4;
  }
  .mermaid {
    text-align: center;
    margin: 20px 0;
  }
  /* Task list styles */
  .task-list-item {
    list-style-type: none;
  }
  .task-list-item input[type="checkbox"] {
    margin-right: 8px;
  }
  ul.contains-task-list {
    padding-left: 0;
  }
  ul.contains-task-list ul.contains-task-list {
    padding-left: 24px;
  }
</style>
`;

/**
 * Mermaid.js CDN スクリプト
 */
const MERMAID_SCRIPT = `
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
  mermaid.initialize({ startOnLoad: true, theme: 'default' });
</script>
`;

/**
 * Mermaid 図のキーワード（言語ラベルがなくても検出）
 */
const MERMAID_KEYWORDS = [
  "graph ",
  "graph\n",
  "flowchart ",
  "flowchart\n",
  "sequenceDiagram",
  "classDiagram",
  "stateDiagram",
  "erDiagram",
  "gantt",
  "pie ",
  "pie\n",
  "gitGraph",
  "mindmap",
  "timeline",
  "quadrantChart",
  "xychart",
  "sankey",
];

/**
 * Mermaid 記法が含まれているか判定
 */
function containsMermaid(content: string): boolean {
  // ```mermaid の明示的なラベル
  if (/```mermaid/i.test(content)) {
    return true;
  }
  // コードブロック内に Mermaid キーワードがあるか
  const codeBlockRegex = /```(?:\w*\n)?([\s\S]*?)```/g;
  const matches = content.matchAll(codeBlockRegex);
  for (const match of matches) {
    const codeContent = match[1].trimStart();
    if (MERMAID_KEYWORDS.some((keyword) => codeContent.startsWith(keyword))) {
      return true;
    }
  }
  return false;
}

/**
 * コードブロックが Mermaid 図かどうか判定
 */
function isMermaidCode(text: string, lang?: string): boolean {
  if (lang === "mermaid") {
    return true;
  }
  // 言語ラベルがない場合、内容で判定
  if (!lang) {
    const trimmed = text.trimStart();
    return MERMAID_KEYWORDS.some((keyword) => trimmed.startsWith(keyword));
  }
  return false;
}

/**
 * 標準の markdown-it インスタンスを作成
 */
function createMarkdownIt() {
  const md = new MarkdownIt({
    html: false, // XSS 対策: HTML タグを無効化
    linkify: true,
    typographer: true,
  });

  // KaTeX プラグイン（数式対応）
  md.use(markdownItKatex);

  // タスクリストプラグイン
  md.use(markdownItTaskLists, {
    enabled: true,
    label: true,
    labelAfter: true,
  });

  return md;
}

/**
 * Mermaid 対応の markdown-it インスタンスを作成
 */
function createMermaidMarkdownIt() {
  const md = createMarkdownIt();

  // コードブロックのレンダラーをカスタマイズ
  const defaultFence =
    md.renderer.rules.fence ||
    ((tokens, idx, options, _env, self) =>
      self.renderToken(tokens, idx, options));

  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const info = token.info ? token.info.trim() : "";
    const content = token.content;

    if (isMermaidCode(content, info)) {
      // Mermaid コンテンツはエスケープしない（Mermaid.js が解釈するため）
      return `<pre class="mermaid">${content}</pre>\n`;
    }

    return defaultFence(tokens, idx, options, env, self);
  };

  return md;
}

/**
 * Markdown コンテンツを HTML に変換
 */
function processMarkdown(content: string): string {
  const hasMermaid = containsMermaid(content);

  // Mermaid がある場合は専用の markdown-it インスタンスを使用
  const md = hasMermaid ? createMermaidMarkdownIt() : createMarkdownIt();
  const htmlContent = md.render(content);

  const mermaidScript = hasMermaid ? MERMAID_SCRIPT : "";

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ClipShip Page</title>
${MARKDOWN_STYLES}
</head>
<body>
${htmlContent}
${HIGHLIGHT_JS_CDN}
${mermaidScript}
</body>
</html>`;
}

/**
 * テキストコンテンツを HTML に変換（pre タグで整形）
 */
function processText(content: string): string {
  const escaped = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ClipShip Page</title>
<style>
  body {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    line-height: 1.5;
    padding: 20px;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
</style>
</head>
<body>
<pre>${escaped}</pre>
</body>
</html>`;
}

/**
 * コンテンツを検出・処理して HTML に変換
 * @param content - クリップボードから取得したコンテンツ
 * @returns 処理済みコンテンツと関連情報
 */
export function processContent(content: string): ProcessedContent {
  const contentInfo = detectContentType(content);

  let processedContent: string;
  switch (contentInfo.type) {
    case "html":
      processedContent = processHtml(content);
      break;
    case "markdown":
      processedContent = processMarkdown(content);
      break;
    default:
      processedContent = processText(content);
  }

  // すべてのコンテンツタイプで HTML として出力
  return {
    content: processedContent,
    filename: "index.html",
    mimeType: "text/html",
    contentInfo,
  };
}
