/**
 * OAuth state パラメータの署名・検証ユーティリティ
 * CSRF 攻撃を防ぐため、state に署名と有効期限を付与
 */

import { hmacSign } from "./crypto";

// state の有効期限 (10分)
const STATE_EXPIRY_MS = 10 * 60 * 1000;

/**
 * State データの型
 */
interface StateData {
  timestamp: number;
  randomId: string;
  extensionRedirect?: string;
}

/**
 * 署名付き state を生成
 * 形式: base64(JSON).signature
 * @param secret - 署名用シークレット
 * @param extensionRedirect - 拡張機能のリダイレクトURL（オプション）
 */
export async function createSignedState(
  secret: string,
  extensionRedirect?: string,
): Promise<string> {
  const data: StateData = {
    timestamp: Date.now(),
    randomId: crypto.randomUUID(),
    extensionRedirect,
  };
  const payload = btoa(JSON.stringify(data));
  const signature = await hmacSign(payload, secret);
  return `${payload}.${signature}`;
}

/**
 * 署名付き state を検証し、データを返す
 * @returns 有効な場合は StateData、無効な場合は null
 */
export async function verifySignedState(
  state: string,
  secret: string,
): Promise<StateData | null> {
  const lastDotIndex = state.lastIndexOf(".");
  if (lastDotIndex === -1) {
    return null;
  }

  const payload = state.substring(0, lastDotIndex);
  const signature = state.substring(lastDotIndex + 1);

  // 署名検証
  const expectedSignature = await hmacSign(payload, secret);
  if (signature !== expectedSignature) {
    return null;
  }

  // ペイロードをデコード
  let data: StateData;
  try {
    data = JSON.parse(atob(payload));
  } catch {
    return null;
  }

  // 有効期限チェック
  if (typeof data.timestamp !== "number") {
    return null;
  }
  if (Date.now() - data.timestamp > STATE_EXPIRY_MS) {
    return null;
  }

  return data;
}
