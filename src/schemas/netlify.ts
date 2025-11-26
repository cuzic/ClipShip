import { z } from "zod";

/**
 * Netlify API デプロイレスポンスのスキーマ
 * POST /api/v1/sites のレスポンス
 */
export const NetlifyDeployResponseSchema = z.object({
  id: z.string(),
  state: z.string(),
  name: z.string().optional(),
  url: z.string(),
  ssl_url: z.string().optional(),
  admin_url: z.string().optional(),
  deploy_url: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  published_deploy: z
    .object({
      id: z.string(),
      state: z.string(),
      url: z.string(),
    })
    .optional(),
});

export type NetlifyDeployResponse = z.infer<typeof NetlifyDeployResponseSchema>;

/**
 * Netlify API エラーレスポンスのスキーマ
 */
export const NetlifyErrorResponseSchema = z.object({
  code: z.number().optional(),
  message: z.string(),
});

export type NetlifyErrorResponse = z.infer<typeof NetlifyErrorResponseSchema>;
