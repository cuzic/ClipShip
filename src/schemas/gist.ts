import { z } from "zod";

/**
 * Gist ファイルのスキーマ
 * OpenAPI: additionalProperties.nullable: true のため nullable 対応
 */
const GistFileSchema = z
  .object({
    filename: z.string().optional(),
    type: z.string().optional(),
    language: z.string().optional(),
    raw_url: z.string().optional(),
    size: z.number().optional(),
    truncated: z.boolean().optional(),
    content: z.string().optional(),
    encoding: z.string().optional(),
  })
  .nullable();

type GistFile = z.infer<typeof GistFileSchema>;

/**
 * Gist オーナーのスキーマ (simple-user の主要フィールド)
 */
const GistOwnerSchema = z.object({
  login: z.string(),
  id: z.number(),
  node_id: z.string().optional(),
  avatar_url: z.string().optional(),
  url: z.string().optional(),
  html_url: z.string().optional(),
  type: z.string().optional(),
});

type GistOwner = z.infer<typeof GistOwnerSchema>;

/**
 * GitHub Gist API レスポンスのスキーマ
 * POST /gists のレスポンス (gist-simple)
 */
export const GistResponseSchema = z.object({
  id: z.string(),
  node_id: z.string().optional(),
  url: z.string(),
  html_url: z.string(),
  forks_url: z.string().optional(),
  commits_url: z.string().optional(),
  git_pull_url: z.string().optional(),
  git_push_url: z.string().optional(),
  files: z.record(z.string(), GistFileSchema),
  public: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  description: z.string().nullable(),
  comments: z.number().optional(),
  comments_url: z.string().optional(),
  owner: GistOwnerSchema.nullable().optional(),
  truncated: z.boolean().optional(),
});

export type GistResponse = z.infer<typeof GistResponseSchema>;
