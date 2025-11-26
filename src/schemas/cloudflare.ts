import { z } from "zod";

/**
 * Cloudflare API レスポンスのベーススキーマ
 */
const CloudflareResponseSchema = <T extends z.ZodTypeAny>(resultSchema: T) =>
  z.object({
    success: z.boolean(),
    errors: z.array(z.object({ code: z.number(), message: z.string() })),
    messages: z.array(z.unknown()),
    result: resultSchema,
  });

/**
 * Cloudflare Pages プロジェクト情報のスキーマ
 */
export const CloudflarePagesProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  subdomain: z.string(),
  domains: z.array(z.string()).optional(),
  created_on: z.string().optional(),
  production_branch: z.string().optional(),
});

export type CloudflarePagesProject = z.infer<
  typeof CloudflarePagesProjectSchema
>;

/**
 * Cloudflare Pages プロジェクトレスポンスのスキーマ
 */
export const CloudflarePagesProjectResponseSchema = CloudflareResponseSchema(
  CloudflarePagesProjectSchema,
);

/**
 * Cloudflare Pages デプロイメント情報のスキーマ
 */
export const CloudflarePagesDeploymentSchema = z.object({
  id: z.string(),
  url: z.string(),
  environment: z.string().optional(),
  deployment_trigger: z
    .object({
      type: z.string(),
      metadata: z.object({}).passthrough().optional(),
    })
    .optional(),
  latest_stage: z
    .object({
      name: z.string(),
      status: z.string(),
    })
    .optional(),
  project_id: z.string().optional(),
  project_name: z.string().optional(),
});

export type CloudflarePagesDeployment = z.infer<
  typeof CloudflarePagesDeploymentSchema
>;

/**
 * Cloudflare Pages デプロイメントレスポンスのスキーマ
 */
export const CloudflarePagesDeploymentResponseSchema = CloudflareResponseSchema(
  CloudflarePagesDeploymentSchema,
);

/**
 * Cloudflare Pages プロジェクト一覧レスポンスのスキーマ
 */
export const CloudflarePagesProjectListResponseSchema =
  CloudflareResponseSchema(z.array(CloudflarePagesProjectSchema));
