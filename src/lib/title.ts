/**
 * タイトル抽出モジュール
 * コンテンツからタイトルを自動抽出する
 */

import type { ContentType } from "./detect";

/**
 * タイトルの最大文字数
 */
const MAX_TITLE_LENGTH = 100;

/**
 * HTML からタイトルを抽出
 * 優先順位: <title> > <h1> > 最初の行
 */
function extractTitleFromHtml(content: string): string | null {
  // <title> タグを検索
  const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch?.[1]?.trim()) {
    return titleMatch[1].trim();
  }

  // <h1> タグを検索
  const h1Match = content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match?.[1]?.trim()) {
    return h1Match[1].trim();
  }

  return null;
}

/**
 * Markdown からタイトルを抽出
 * 最初の # 見出しを使用
 */
function extractTitleFromMarkdown(content: string): string | null {
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    // # 見出し（ATX スタイル）
    const headingMatch = trimmed.match(/^#+\s+(.+)$/);
    if (headingMatch?.[1]?.trim()) {
      return headingMatch[1].trim();
    }
  }

  return null;
}

/**
 * プレーンテキストからタイトルを抽出
 * 最初の非空行を使用
 */
function extractTitleFromText(content: string): string | null {
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return null;
}

/**
 * 日時ベースのデフォルトタイトルを生成
 */
function generateDefaultTitle(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * タイトルを切り詰める
 */
function truncateTitle(title: string): string {
  if (title.length <= MAX_TITLE_LENGTH) {
    return title;
  }
  return `${title.slice(0, MAX_TITLE_LENGTH - 3)}...`;
}

/**
 * コンテンツからタイトルを抽出
 * 抽出できない場合は日時ベースのデフォルトタイトルを返す
 */
export function extractTitle(
  content: string,
  contentType: ContentType,
): string {
  let title: string | null = null;

  switch (contentType) {
    case "html":
      title = extractTitleFromHtml(content);
      break;
    case "markdown":
      title = extractTitleFromMarkdown(content);
      break;
    case "text":
      title = extractTitleFromText(content);
      break;
  }

  // タイトルが取得できなかった場合はデフォルト
  if (!title) {
    return generateDefaultTitle();
  }

  return truncateTitle(title);
}
