/**
 * ハッシュ計算ユーティリティ
 */

type HashAlgorithm = "SHA-1" | "SHA-256";

/**
 * 文字列のハッシュを計算
 */
export async function hashContent(
  content: string,
  algorithm: HashAlgorithm,
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest(algorithm, data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * SHA-1 ハッシュを計算
 */
export function sha1(content: string): Promise<string> {
  return hashContent(content, "SHA-1");
}

/**
 * SHA-256 ハッシュを計算
 */
export function sha256(content: string): Promise<string> {
  return hashContent(content, "SHA-256");
}
