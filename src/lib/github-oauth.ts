/**
 * GitHub OAuth フロー管理
 * Chrome拡張機能からNetlify Functions経由でGitHub OAuthを実行
 */

import { ResultAsync, errAsync, okAsync } from "neverthrow";
import { getStorageData, setStorageData } from "./storage";

// Netlify Functions の URL（本番環境にデプロイ後に更新）
const OAUTH_BASE_URL = "https://pastehost-oauth.netlify.app";

/**
 * OAuth エラー
 */
export class OAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OAuthError";
  }
}

/**
 * 認可URLレスポンスの型
 */
interface AuthUrlResponse {
  authUrl: string;
  state: string;
}

/**
 * GitHub OAuth フローを開始
 * chrome.identity.launchWebAuthFlow を使用して認証
 */
export function startGitHubOAuth(): ResultAsync<string, OAuthError> {
  return ResultAsync.fromPromise(
    (async () => {
      // 1. 拡張機能のリダイレクトURLを取得
      const extensionRedirectUrl = chrome.identity.getRedirectURL("callback");

      // 2. Netlify Function から認可URL取得（拡張機能のリダイレクトURLを渡す）
      const authRequestUrl = new URL(`${OAUTH_BASE_URL}/api/github-auth`);
      authRequestUrl.searchParams.set(
        "extension_redirect",
        extensionRedirectUrl,
      );

      const authResponse = await fetch(authRequestUrl.toString());
      if (!authResponse.ok) {
        throw new Error("Failed to get authorization URL");
      }
      const { authUrl }: AuthUrlResponse = await authResponse.json();

      // 3. chrome.identity.launchWebAuthFlow で OAuth フロー開始
      // authUrl にはすでに redirect_uri と state が含まれている
      const redirectUrl = await launchOAuthFlow(authUrl);

      // 4. リダイレクトURLからトークンを抽出
      const accessToken = extractTokenFromUrl(redirectUrl);
      if (!accessToken) {
        throw new Error("Failed to extract access token from redirect URL");
      }

      // 5. ストレージに保存
      await setStorageData("githubOAuthToken", accessToken);

      return accessToken;
    })(),
    (error) =>
      new OAuthError(
        error instanceof Error ? error.message : "GitHub OAuth failed",
      ),
  );
}

/**
 * chrome.identity.launchWebAuthFlow のPromiseラッパー
 */
function launchOAuthFlow(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      {
        url,
        interactive: true,
      },
      (redirectUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!redirectUrl) {
          reject(new Error("No redirect URL received"));
          return;
        }
        resolve(redirectUrl);
      },
    );
  });
}

/**
 * リダイレクトURLからアクセストークンを抽出
 * URLフラグメント (#access_token=xxx) から取得
 */
function extractTokenFromUrl(redirectUrl: string): string | null {
  try {
    const url = new URL(redirectUrl);
    const hash = url.hash.substring(1); // # を除去
    const params = new URLSearchParams(hash);
    return params.get("access_token");
  } catch {
    return null;
  }
}

/**
 * GitHub OAuth トークンを取得（ストレージから）
 * トークンがない場合は null を返す
 */
export function getGitHubOAuthToken(): ResultAsync<string | null, OAuthError> {
  return ResultAsync.fromSafePromise(getStorageData("githubOAuthToken")).map(
    (token) => token ?? null,
  );
}

/**
 * GitHub OAuth トークンをクリア（ログアウト）
 */
export function clearGitHubOAuthToken(): ResultAsync<void, OAuthError> {
  return ResultAsync.fromPromise(
    setStorageData("githubOAuthToken", ""),
    () => new OAuthError("Failed to clear OAuth token"),
  );
}

/**
 * GitHub ユーザー情報を取得（認証確認用）
 */
interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string | null;
}

export function getGitHubUser(
  token: string,
): ResultAsync<GitHubUser, OAuthError> {
  return ResultAsync.fromPromise(
    fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error("Failed to fetch GitHub user");
      }
      return response.json() as Promise<GitHubUser>;
    }),
    () => new OAuthError("Failed to get GitHub user info"),
  );
}
