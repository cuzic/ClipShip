/**
 * コンテンツタイプ検出モジュール
 * クリップボードの内容から HTML / Markdown / テキストを判定
 */

export type ContentType = "html" | "markdown" | "text";

export interface ContentInfo {
  type: ContentType;
  extension: string;
  mimeType: string;
}

/**
 * HTML かどうかを判定
 * - DOCTYPE 宣言
 * - <html>, <head>, <body> タグ
 * - 一般的な HTML タグ
 */
function isHtml(content: string): boolean {
  const trimmed = content.trim();

  // DOCTYPE 宣言
  if (/^<!doctype\s+html/i.test(trimmed)) {
    return true;
  }

  // <html> タグで始まる
  if (/^<html[\s>]/i.test(trimmed)) {
    return true;
  }

  // 主要な HTML 構造タグが含まれている（属性付きも対応）
  // script, style は危険なタグなので除外（Markdown 内に埋め込まれている可能性がある）
  const htmlTags =
    /<(?:html|head|body|div|span|p|h[1-6]|ul|ol|li|table|tr|td|th|form|input|button|link|meta|header|footer|nav|section|article|aside|main)[\s>]/i;
  if (htmlTags.test(content)) {
    return true;
  }

  // <a href="..."> や <img src="..."> のような属性付きタグ
  if (/<a\s+[^>]*href\s*=/i.test(content)) {
    return true;
  }
  if (/<img\s+[^>]*src\s*=/i.test(content)) {
    return true;
  }

  return false;
}

/**
 * Markdown かどうかを判定
 * - 見出し (# ## ###)
 * - リスト (- * 1.)
 * - コードブロック (```)
 * - リンク [text](url)
 * - 画像 ![alt](url)
 * - 強調 **bold** *italic*
 */
function isMarkdown(content: string): boolean {
  const lines = content.split("\n");
  let markdownScore = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // 見出し
    if (/^#{1,6}\s+\S/.test(trimmed)) {
      markdownScore += 2;
    }

    // リスト (- または * または数字.)
    if (/^[-*]\s+\S/.test(trimmed) || /^\d+\.\s+\S/.test(trimmed)) {
      markdownScore += 1;
    }

    // コードブロック
    if (/^```/.test(trimmed)) {
      markdownScore += 2;
    }

    // 引用
    if (/^>\s+/.test(trimmed)) {
      markdownScore += 1;
    }

    // 水平線
    if (/^[-*_]{3,}$/.test(trimmed)) {
      markdownScore += 1;
    }
  }

  // リンク [text](url)
  if (/\[.+?\]\(.+?\)/.test(content)) {
    markdownScore += 2;
  }

  // 画像 ![alt](url)
  if (/!\[.*?\]\(.+?\)/.test(content)) {
    markdownScore += 2;
  }

  // 強調 **bold** or __bold__
  if (/\*\*.+?\*\*|__.+?__/.test(content)) {
    markdownScore += 2;
  }

  // イタリック *italic* or _italic_ (単語境界を考慮)
  if (
    /(?<!\*)\*[^*\s][^*]*[^*\s]\*(?!\*)|(?<!_)_[^_\s][^_]*[^_\s]_(?!_)/.test(
      content,
    )
  ) {
    markdownScore += 1;
  }

  // インラインコード `code`
  if (/`[^`]+`/.test(content)) {
    markdownScore += 2;
  }

  // スコアが一定以上なら Markdown と判定
  return markdownScore >= 2;
}

/**
 * コンテンツタイプを検出する
 */
export function detectContentType(content: string): ContentInfo {
  if (isHtml(content)) {
    return {
      type: "html",
      extension: "html",
      mimeType: "text/html",
    };
  }

  if (isMarkdown(content)) {
    return {
      type: "markdown",
      extension: "md",
      mimeType: "text/markdown",
    };
  }

  return {
    type: "text",
    extension: "txt",
    mimeType: "text/plain",
  };
}
