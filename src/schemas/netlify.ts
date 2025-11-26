import { z } from "zod";

/**
 * Netlify サイト情報のスキーマ (GET /api/v1/sites)
 */
export const NetlifySiteSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  ssl_url: z.string().optional(),
  admin_url: z.string().optional(),
});

export type NetlifySite = z.infer<typeof NetlifySiteSchema>;
