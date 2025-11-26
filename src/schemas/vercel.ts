import { z } from "zod";

/**
 * Vercel プロジェクト情報のスキーマ
 */
export const VercelProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  accountId: z.string(),
  link: z
    .object({
      type: z.string(),
      deployHooks: z.array(z.unknown()).optional(),
    })
    .optional(),
});

export type VercelProject = z.infer<typeof VercelProjectSchema>;

/**
 * Vercel デプロイメント情報のスキーマ
 */
export const VercelDeploymentSchema = z.object({
  id: z.string(),
  url: z.string(),
  name: z.string(),
  state: z.string().optional(),
  readyState: z.string().optional(),
  createdAt: z.number().optional(),
});

export type VercelDeployment = z.infer<typeof VercelDeploymentSchema>;

/**
 * Vercel ファイルアップロードレスポンスのスキーマ
 */
export const VercelFileUploadSchema = z.object({
  sha: z.string(),
  size: z.number(),
  contentType: z.string().optional(),
});

export type VercelFileUpload = z.infer<typeof VercelFileUploadSchema>;
