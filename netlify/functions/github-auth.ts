import type { Config } from "@netlify/functions";
import { createSignedState } from "./lib/state";

/**
 * GitHub OAuth 認可URL生成エンドポイント
 * GET /api/github-auth
 */
export default async (req: Request) => {
  const clientId = Netlify.env.get("GITHUB_CLIENT_ID");
  const stateSecret = Netlify.env.get("STATE_SECRET");

  if (!clientId) {
    return new Response(
      JSON.stringify({ error: "GITHUB_CLIENT_ID not configured" }),
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

  // CSRF対策用の署名付き state パラメータを生成
  const state = await createSignedState(stateSecret);

  // GitHub OAuth認可URL生成
  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("scope", "gist");
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
  path: "/api/github-auth",
};
