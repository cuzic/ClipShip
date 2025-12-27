/**
 * Netlify Functions E2E テスト
 * 実際のデプロイ済みエンドポイントに対するテスト
 */

import { expect, test } from "@playwright/test";

const OAUTH_BASE_URL = "https://pastehost-oauth.netlify.app";
const TEST_EXTENSION_REDIRECT =
  "https://test-extension-id.chromiumapp.org/callback";

test.describe("Netlify Functions - OAuth Endpoints", () => {
  test.describe("GitHub OAuth", () => {
    test("GET /api/github-auth should return authUrl and state", async ({
      request,
    }) => {
      const response = await request.get(
        `${OAUTH_BASE_URL}/api/github-auth?extension_redirect=${encodeURIComponent(TEST_EXTENSION_REDIRECT)}`,
      );

      expect(response.status()).toBe(200);

      const json = await response.json();

      // authUrl が正しい形式であることを確認
      expect(json.authUrl).toBeDefined();
      expect(json.authUrl).toContain(
        "https://github.com/login/oauth/authorize",
      );
      expect(json.authUrl).toContain("client_id=");
      expect(json.authUrl).toContain("scope=gist");
      expect(json.authUrl).toContain("state=");

      // state が存在することを確認
      expect(json.state).toBeDefined();
      expect(typeof json.state).toBe("string");
      expect(json.state.length).toBeGreaterThan(0);

      // state が authUrl 内の state と一致することを確認
      expect(json.authUrl).toContain(`state=${json.state}`);
    });

    test("GET /api/github-callback without code should return 400", async ({
      request,
    }) => {
      const response = await request.get(
        `${OAUTH_BASE_URL}/api/github-callback`,
      );

      expect(response.status()).toBe(400);

      const json = await response.json();
      expect(json.error).toBe("Missing authorization code");
    });

    test("GET /api/github-callback without state should return 400", async ({
      request,
    }) => {
      const response = await request.get(
        `${OAUTH_BASE_URL}/api/github-callback?code=test_code`,
      );

      expect(response.status()).toBe(400);

      const json = await response.json();
      expect(json.error).toBe("Missing state parameter");
    });

    test("GET /api/github-callback with invalid state should return 400", async ({
      request,
    }) => {
      const response = await request.get(
        `${OAUTH_BASE_URL}/api/github-callback?code=test_code&state=invalid_state`,
      );

      expect(response.status()).toBe(400);

      const json = await response.json();
      expect(json.error).toBe("Invalid or expired state parameter");
    });
  });

  test.describe("Netlify OAuth", () => {
    test("GET /api/netlify-oauth-auth should return authUrl and state", async ({
      request,
    }) => {
      const response = await request.get(
        `${OAUTH_BASE_URL}/api/netlify-oauth-auth?extension_redirect=${encodeURIComponent(TEST_EXTENSION_REDIRECT)}`,
      );

      expect(response.status()).toBe(200);

      const json = await response.json();

      // authUrl が正しい形式であることを確認
      expect(json.authUrl).toBeDefined();
      expect(json.authUrl).toContain("https://app.netlify.com/authorize");
      expect(json.authUrl).toContain("client_id=");
      expect(json.authUrl).toContain("response_type=code");
      expect(json.authUrl).toContain("redirect_uri=");
      expect(json.authUrl).toContain("state=");

      // state が存在することを確認
      expect(json.state).toBeDefined();
      expect(typeof json.state).toBe("string");
      expect(json.state.length).toBeGreaterThan(0);
    });

    test("GET /api/netlify-oauth-callback without code should return 400", async ({
      request,
    }) => {
      const response = await request.get(
        `${OAUTH_BASE_URL}/api/netlify-oauth-callback`,
      );

      expect(response.status()).toBe(400);

      const json = await response.json();
      expect(json.error).toBe("Missing authorization code");
    });

    test("GET /api/netlify-oauth-callback without state should return 400", async ({
      request,
    }) => {
      const response = await request.get(
        `${OAUTH_BASE_URL}/api/netlify-oauth-callback?code=test_code`,
      );

      expect(response.status()).toBe(400);

      const json = await response.json();
      expect(json.error).toBe("Missing state parameter");
    });

    test("GET /api/netlify-oauth-callback with invalid state should return 400", async ({
      request,
    }) => {
      const response = await request.get(
        `${OAUTH_BASE_URL}/api/netlify-oauth-callback?code=test_code&state=invalid_state`,
      );

      expect(response.status()).toBe(400);

      const json = await response.json();
      expect(json.error).toBe("Invalid or expired state parameter");
    });
  });

  test.describe("State Parameter Security", () => {
    test("GitHub OAuth state should be unique per request", async ({
      request,
    }) => {
      const authUrl = `${OAUTH_BASE_URL}/api/github-auth?extension_redirect=${encodeURIComponent(TEST_EXTENSION_REDIRECT)}`;
      const response1 = await request.get(authUrl);
      const response2 = await request.get(authUrl);

      const json1 = await response1.json();
      const json2 = await response2.json();

      // 各リクエストで異なる state が生成されることを確認
      expect(json1.state).not.toBe(json2.state);
    });

    test("Netlify OAuth state should be unique per request", async ({
      request,
    }) => {
      const authUrl = `${OAUTH_BASE_URL}/api/netlify-oauth-auth?extension_redirect=${encodeURIComponent(TEST_EXTENSION_REDIRECT)}`;
      const response1 = await request.get(authUrl);
      const response2 = await request.get(authUrl);

      const json1 = await response1.json();
      const json2 = await response2.json();

      // 各リクエストで異なる state が生成されることを確認
      expect(json1.state).not.toBe(json2.state);
    });

    test("State should contain base64 payload and signature", async ({
      request,
    }) => {
      const response = await request.get(
        `${OAUTH_BASE_URL}/api/github-auth?extension_redirect=${encodeURIComponent(TEST_EXTENSION_REDIRECT)}`,
      );
      const json = await response.json();

      // state の形式を確認: base64payload.signature
      const lastDotIndex = json.state.lastIndexOf(".");
      expect(lastDotIndex).toBeGreaterThan(0);

      const payload = json.state.substring(0, lastDotIndex);
      const signature = json.state.substring(lastDotIndex + 1);

      // payload が Base64 デコード可能であることを確認
      const decoded = JSON.parse(atob(payload));
      expect(decoded.timestamp).toBeDefined();
      expect(decoded.randomId).toBeDefined();
      expect(decoded.extensionRedirect).toBe(TEST_EXTENSION_REDIRECT);

      // タイムスタンプが現在時刻に近いことを確認（10分以内）
      const now = Date.now();
      expect(Math.abs(now - decoded.timestamp)).toBeLessThan(10 * 60 * 1000);

      // signature が存在することを確認
      expect(signature.length).toBeGreaterThan(0);
    });
  });

  test.describe("CORS Headers", () => {
    test("GitHub auth endpoint should have CORS headers", async ({
      request,
    }) => {
      const response = await request.get(
        `${OAUTH_BASE_URL}/api/github-auth?extension_redirect=${encodeURIComponent(TEST_EXTENSION_REDIRECT)}`,
      );

      // Access-Control-Allow-Origin ヘッダーを確認
      const corsHeader = response.headers()["access-control-allow-origin"];
      expect(corsHeader).toBe("*");
    });
  });

  test.describe("Response Format", () => {
    test("All endpoints should return JSON content-type", async ({
      request,
    }) => {
      const endpoints = [
        "/api/github-auth",
        "/api/netlify-oauth-auth",
        "/api/github-callback",
        "/api/netlify-oauth-callback",
      ];

      for (const endpoint of endpoints) {
        const response = await request.get(`${OAUTH_BASE_URL}${endpoint}`);
        const contentType = response.headers()["content-type"];
        expect(contentType).toContain("application/json");
      }
    });
  });
});

test.describe("Netlify Functions - OAuth Flow Integration", () => {
  test("GitHub OAuth flow: auth -> callback with valid state", async ({
    request,
  }) => {
    // Step 1: 認証URLを取得
    const authResponse = await request.get(
      `${OAUTH_BASE_URL}/api/github-auth?extension_redirect=${encodeURIComponent(TEST_EXTENSION_REDIRECT)}`,
    );
    expect(authResponse.status()).toBe(200);

    const authJson = await authResponse.json();
    const state = authJson.state;

    // Step 2: 有効な state でコールバックを呼び出し（コードは無効だが state は有効）
    // 注: 実際の OAuth コードがないため、GitHub API からエラーが返る
    const callbackResponse = await request.get(
      `${OAUTH_BASE_URL}/api/github-callback?code=invalid_code&state=${state}`,
    );

    // state は有効なので、GitHub API の認可コード交換エラーが返る（400）
    expect(callbackResponse.status()).toBe(400);

    const callbackJson = await callbackResponse.json();
    // bad_verification_code エラーが返ることを確認
    expect(callbackJson.error).toBe("bad_verification_code");
  });

  test("Netlify OAuth flow: auth -> callback with valid state", async ({
    request,
  }) => {
    // Step 1: 認証URLを取得
    const authResponse = await request.get(
      `${OAUTH_BASE_URL}/api/netlify-oauth-auth?extension_redirect=${encodeURIComponent(TEST_EXTENSION_REDIRECT)}`,
    );
    expect(authResponse.status()).toBe(200);

    const authJson = await authResponse.json();
    const state = authJson.state;

    // Step 2: 有効な state でコールバックを呼び出し
    const callbackResponse = await request.get(
      `${OAUTH_BASE_URL}/api/netlify-oauth-callback?code=invalid_code&state=${state}`,
    );

    // state は有効なので、Netlify API の認可コード交換エラーが返る（400）
    expect(callbackResponse.status()).toBe(400);

    const callbackJson = await callbackResponse.json();
    // Netlify の invalid_grant エラーを確認
    expect(callbackJson.error).toBeDefined();
  });

  test("State should expire after modification", async ({ request }) => {
    // 認証URLを取得
    const authResponse = await request.get(
      `${OAUTH_BASE_URL}/api/github-auth?extension_redirect=${encodeURIComponent(TEST_EXTENSION_REDIRECT)}`,
    );
    const authJson = await authResponse.json();
    const state = authJson.state;

    // state を改ざん（署名部分を変更）
    const lastDotIndex = state.lastIndexOf(".");
    const payload = state.substring(0, lastDotIndex);
    const tamperedState = `${payload}.tampered_signature`;

    // 改ざんされた state でコールバックを呼び出し
    const callbackResponse = await request.get(
      `${OAUTH_BASE_URL}/api/github-callback?code=test_code&state=${tamperedState}`,
    );

    expect(callbackResponse.status()).toBe(400);

    const callbackJson = await callbackResponse.json();
    expect(callbackJson.error).toBe("Invalid or expired state parameter");
  });
});
