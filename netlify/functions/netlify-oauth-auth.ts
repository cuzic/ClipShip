import type { Config } from "@netlify/functions";
import { createSignedState } from "./lib/state";

/**
 * Netlify OAuth 認可URL生成エンドポイント
 * GET /api/netlify-oauth-auth
 */
export default async (req: Request) => {
  const clientId = Netlify.env.get("NETLIFY_OAUTH_CLIENT_ID");
  const stateSecret = Netlify.env.get("STATE_SECRET");

  if (!clientId) {
    return new Response(
      JSON.stringify({ error: "NETLIFY_OAUTH_CLIENT_ID not configured" }),
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

  // 拡張機能のリダイレクトURLを取得
  const url = new URL(req.url);
  const extensionRedirect = url.searchParams.get("extension_redirect");
  if (!extensionRedirect) {
    return new Response(
      JSON.stringify({ error: "Missing extension_redirect parameter" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // CSRF対策用の署名付き state パラメータを生成（extensionRedirect を含む）
  const state = await createSignedState(stateSecret, extensionRedirect);

  // コールバックURL（同じNetlifyサイト上）
  // 注: redirect_uri にクエリパラメータを含めると OAuth プロバイダーで拒否される
  // extensionRedirect は state パラメータに含めて渡す
  const redirectUri = `${url.origin}/api/netlify-oauth-callback`;

  // Netlify OAuth認可URL生成
  const authUrl = new URL("https://app.netlify.com/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);

  return new Response(
    JSON.stringify({
      authUrl: authUrl.toString(),
      state,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
};

export const config: Config = {
  path: "/api/netlify-oauth-auth",
};
