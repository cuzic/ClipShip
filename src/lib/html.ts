/**
 * HTML テンプレート生成モジュール
 * クリップボードのテキストを完全なHTML構造に埋め込む
 */

/**
 * テキストを完全なHTMLドキュメントに埋め込む
 * @param content - 埋め込むHTMLコンテンツ
 * @returns 完全なHTMLドキュメント
 */
export function createHtml(content: string): string {
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
