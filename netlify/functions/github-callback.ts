import type { Config } from "@netlify/functions";
import { verifySignedState } from "./lib/state";

interface GitHubTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

/**
 * GitHub OAuth コールバックエンドポイント
 * GET /api/github-callback?code=xxx&state=xxx
 *
 * 認可コードをアクセストークンに交換し、
 * Chrome拡張機能に返すHTMLページを生成
 */
export default async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code) {
    return new Response(
      JSON.stringify({ error: "Missing authorization code" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (!state) {
    return new Response(JSON.stringify({ error: "Missing state parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const clientId = Netlify.env.get("GITHUB_CLIENT_ID");
  const clientSecret = Netlify.env.get("GITHUB_CLIENT_SECRET");
  const stateSecret = Netlify.env.get("STATE_SECRET");

  if (!clientId || !clientSecret) {
    return new Response(
      JSON.stringify({ error: "OAuth credentials not configured" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (!stateSecret) {
    return new Response(
      JSON.stringify({ error: "STATE_SECRET not configured" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // state パラメータの署名と有効期限を検証
  const isValidState = await verifySignedState(state, stateSecret);
  if (!isValidState) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired state parameter" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // 認可コードをアクセストークンに交換
  const tokenResponse = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    },
  );

  const tokenData: GitHubTokenResponse = await tokenResponse.json();

  if (tokenData.error) {
    return new Response(
      JSON.stringify({
        error: tokenData.error,
        error_description: tokenData.error_description,
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Chrome拡張機能にトークンを返すHTMLページ
  // chrome.identity.launchWebAuthFlow のリダイレクト先として機能
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>ClipShip - GitHub認証完了</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: #f6f8fa;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .success {
      color: #22863a;
      font-size: 1.2rem;
      margin-bottom: 1rem;
    }
    .info {
      color: #586069;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="success">GitHub認証が完了しました</div>
    <div class="info">このウィンドウは自動的に閉じます...</div>
  </div>
</body>
</html>`;

  // トークン情報をURLフラグメントとして付加してリダイレクト
  // これによりchrome.identity.launchWebAuthFlowがトークンを取得可能
  const redirectUrl = new URL(req.url);
  redirectUrl.search = "";
  redirectUrl.hash = [
    `access_token=${encodeURIComponent(tokenData.access_token || "")}`,
    `token_type=${encodeURIComponent(tokenData.token_type || "")}`,
    `scope=${encodeURIComponent(tokenData.scope || "")}`,
  ].join("&");

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html",
      // フラグメント付きURLにリダイレクト
      Refresh: `0; url=${redirectUrl.toString()}`,
    },
  });
};

export const config: Config = {
  path: "/api/github-callback",
};
