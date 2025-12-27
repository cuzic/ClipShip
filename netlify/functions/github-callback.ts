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

  // state パラメータの署名と有効期限を検証し、データを取得
  const stateData = await verifySignedState(state, stateSecret);
  if (!stateData) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired state parameter" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // 拡張機能のリダイレクトURLを取得
  const extensionRedirect = stateData.extensionRedirect;
  if (!extensionRedirect) {
    return new Response(
      JSON.stringify({ error: "Missing extension_redirect in state" }),
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

  // トークン情報をURLフラグメントとして付加してリダイレクト
  // chrome.identity.launchWebAuthFlow がこのURLを受け取る
  const redirectUrl = new URL(extensionRedirect);
  redirectUrl.hash = [
    `access_token=${encodeURIComponent(tokenData.access_token || "")}`,
    `token_type=${encodeURIComponent(tokenData.token_type || "")}`,
    `scope=${encodeURIComponent(tokenData.scope || "")}`,
  ].join("&");

  // 302リダイレクトで拡張機能のURLに直接リダイレクト
  return new Response(null, {
    status: 302,
    headers: {
      Location: redirectUrl.toString(),
    },
  });
};

export const config: Config = {
  path: "/api/github-callback",
};
