/**
 * OAuth state パラメータの署名・検証ユーティリティ
 * CSRF 攻撃を防ぐため、state に署名と有効期限を付与
 */

// state の有効期限 (10分)
const STATE_EXPIRY_MS = 10 * 60 * 1000;

/**
 * HMAC-SHA256 で署名を生成
 */
async function hmacSign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * 署名付き state を生成
 * 形式: timestamp.randomId.signature
 */
export async function createSignedState(secret: string): Promise<string> {
  const timestamp = Date.now().toString();
  const randomId = crypto.randomUUID();
  const payload = `${timestamp}.${randomId}`;
  const signature = await hmacSign(payload, secret);
  return `${payload}.${signature}`;
}

/**
 * 署名付き state を検証
 * @returns 有効な場合は true、無効な場合は false
 */
export async function verifySignedState(
  state: string,
  secret: string,
): Promise<boolean> {
  const parts = state.split(".");
  if (parts.length !== 3) {
    return false;
  }

  const [timestamp, randomId, signature] = parts;

  // 有効期限チェック
  const stateTime = Number.parseInt(timestamp, 10);
  if (Number.isNaN(stateTime)) {
    return false;
  }
  if (Date.now() - stateTime > STATE_EXPIRY_MS) {
    return false;
  }

  // 署名検証
  const payload = `${timestamp}.${randomId}`;
  const expectedSignature = await hmacSign(payload, secret);
  return signature === expectedSignature;
}
