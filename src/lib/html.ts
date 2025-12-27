/**
 * HTML テンプレート生成モジュール
 * クリップボードのテキストを完全なHTML構造に埋め込む
 */

// @ts-expect-error: No type definitions available
import markdownItKatex from "@iktakahiro/markdown-it-katex";
import MarkdownIt from "markdown-it";
import { full as markdownItEmoji } from "markdown-it-emoji";
import markdownItFootnote from "markdown-it-footnote";
// @ts-expect-error: No type definitions available
import markdownItTaskLists from "markdown-it-task-lists";
import { type ContentInfo, detectContentType } from "./detect";
import type { CssTheme } from "./storage";

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
<title>PasteHost Page</title>
</head>
<body>
${content}
</body>
</html>`;
}

/**
 * highlight.js CDN (シンタックスハイライト)
 * 全言語対応版（190+言語）を使用
 * https://highlightjs.org/download
 */
const HIGHLIGHT_JS_CDN = `
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11/styles/github.min.css">
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/highlight.min.js"></script>
<script>hljs.highlightAll();</script>
`;

/**
 * KaTeX CDN (数式レンダリング)
 */
const KATEX_CDN = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.css">`;

/**
 * CSS テーマの CDN リンク
 */
const CSS_THEME_CDN: Record<CssTheme, string> = {
  default: "",
  github: `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/github-markdown-css@5/github-markdown-light.css">`,
  "github-dark": `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/github-markdown-css@5/github-markdown-dark.css">`,
  water: `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/water.css@2/out/light.css">`,
  "water-dark": `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/water.css@2/out/dark.css">`,
  pico: `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.classless.min.css">`,
  sakura: `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sakura.css/css/sakura.css">`,
};

/**
 * テーマに応じたコンテンツラッパー
 * - github-markdown-css: <article class="markdown-body"> でラップ
 * - pico classless: <main> でラップ（classless 版の要件）
 */
function wrapContent(content: string, theme: CssTheme): string {
  if (theme === "github" || theme === "github-dark") {
    return `<article class="markdown-body">\n${content}\n</article>`;
  }
  if (theme === "pico") {
    return `<main>\n${content}\n</main>`;
  }
  return content;
}

/**
 * デフォルトスタイル（CSS テーマを使用しない場合）
 */
const DEFAULT_STYLES = `
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
    background: #fff;
    padding: 16px;
    border-radius: 6px;
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
  /* Footnote styles */
  .footnotes {
    margin-top: 2em;
    padding-top: 1em;
    border-top: 1px solid #ddd;
    font-size: 0.9em;
  }
  .footnotes-list {
    padding-left: 1.5em;
  }
  .footnote-ref {
    text-decoration: none;
  }
  .footnote-backref {
    text-decoration: none;
    margin-left: 4px;
  }
  /* Strikethrough */
  s, del {
    text-decoration: line-through;
    color: #666;
  }
</style>
`;

/**
 * github-markdown-css 用の追加スタイル
 */
const GITHUB_EXTRA_STYLES = `
<style>
  .markdown-body {
    box-sizing: border-box;
    min-width: 200px;
    max-width: 980px;
    margin: 0 auto;
    padding: 45px;
  }
  @media (max-width: 767px) {
    .markdown-body {
      padding: 15px;
    }
  }
</style>
`;

/**
 * ダークテーマ用の Mermaid スタイル
 */
const MERMAID_DARK_STYLES = `
<style>
  .mermaid {
    background: #1e1e1e;
    padding: 16px;
    border-radius: 6px;
  }
</style>
`;

/**
 * ダークテーマかどうか判定
 */
function isDarkTheme(theme: CssTheme): boolean {
  return theme === "github-dark" || theme === "water-dark";
}

/**
 * テーマに応じたスタイルを取得
 */
function getThemeStyles(theme: CssTheme): string {
  if (theme === "default") {
    return DEFAULT_STYLES;
  }

  const cdnLink = CSS_THEME_CDN[theme];
  const extraStyles =
    theme === "github" || theme === "github-dark" ? GITHUB_EXTRA_STYLES : "";

  return `${cdnLink}\n${extraStyles}`;
}

/**
 * Mermaid.js CDN スクリプトを生成
 * ダークテーマの場合は Mermaid の dark テーマを使用
 */
function getMermaidScript(isDark: boolean): string {
  const mermaidTheme = isDark ? "dark" : "default";
  return `
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
  mermaid.initialize({ startOnLoad: true, theme: '${mermaidTheme}' });
</script>
`;
}

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

  // 脚注プラグイン
  md.use(markdownItFootnote);

  // Emoji プラグイン
  md.use(markdownItEmoji);

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
function processMarkdown(content: string, theme: CssTheme = "default"): string {
  const hasMermaid = containsMermaid(content);
  const isDark = isDarkTheme(theme);

  // Mermaid がある場合は専用の markdown-it インスタンスを使用
  const md = hasMermaid ? createMermaidMarkdownIt() : createMarkdownIt();
  const htmlContent = md.render(content);

  const mermaidScript = hasMermaid ? getMermaidScript(isDark) : "";
  const mermaidStyles = hasMermaid && isDark ? MERMAID_DARK_STYLES : "";
  const themeStyles = getThemeStyles(theme);
  const wrappedContent = wrapContent(htmlContent, theme);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PasteHost Page</title>
${KATEX_CDN}
${themeStyles}
${mermaidStyles}
</head>
<body>
${wrappedContent}
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
<title>PasteHost Page</title>
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
 * 目次ページのエントリ型
 */
export interface TocEntry {
  title: string;
  url: string;
}

/**
 * 目次ページの HTML を生成
 */
export function generateTocHtml(title: string, entries: TocEntry[]): string {
  const escapedTitle = title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const listItems = entries
    .map((entry) => {
      const escapedEntryTitle = entry.title
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      const escapedUrl = entry.url
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;");
      return `    <li><a href="${escapedUrl}" target="_blank" rel="noopener noreferrer">${escapedEntryTitle}</a></li>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapedTitle}</title>
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    line-height: 1.8;
    max-width: 800px;
    margin: 0 auto;
    padding: 40px 20px;
    color: #333;
  }
  h1 {
    font-size: 28px;
    font-weight: 600;
    margin-bottom: 32px;
    padding-bottom: 16px;
    border-bottom: 2px solid #eee;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  li {
    margin-bottom: 12px;
    padding: 12px 16px;
    background: #f8f9fa;
    border-radius: 8px;
    transition: background-color 0.2s ease;
  }
  li:hover {
    background: #e9ecef;
  }
  a {
    color: #0066cc;
    text-decoration: none;
    font-size: 16px;
    display: block;
  }
  a:hover {
    text-decoration: underline;
  }
  .footer {
    margin-top: 40px;
    padding-top: 20px;
    border-top: 1px solid #eee;
    font-size: 12px;
    color: #999;
    text-align: center;
  }
</style>
</head>
<body>
<h1>${escapedTitle}</h1>
<ul>
${listItems}
</ul>
<div class="footer">Generated by PasteHost</div>
</body>
</html>`;
}

/**
 * コンテンツを検出・処理して HTML に変換
 * @param content - クリップボードから取得したコンテンツ
 * @param theme - CSS テーマ（Markdown の場合のみ適用）
 * @returns 処理済みコンテンツと関連情報
 */
export function processContent(
  content: string,
  theme: CssTheme = "default",
): ProcessedContent {
  const contentInfo = detectContentType(content);

  let processedContent: string;
  switch (contentInfo.type) {
    case "html":
      processedContent = processHtml(content);
      break;
    case "markdown":
      processedContent = processMarkdown(content, theme);
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
