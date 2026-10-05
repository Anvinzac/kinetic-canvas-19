/**
 * Shared admin search params validator.
 *
 * Exports: adminSearchSchema, AdminSearch
 * Depends on: zod
 */

import { z } from "zod";

export const adminSearchSchema = z.object({
  range: z.enum(["24h", "7d", "30d", "custom"]).optional().default("30d"),
  from: z.string().optional(),
  to: z.string().optional(),
  app: z.string().optional().default("kinetic-canvas"),
  /** Pre-filled search text, e.g. the word a report links to on the Vocabulary page. */
  q: z.string().max(64).optional(),
});

export type AdminSearch = z.infer<typeof adminSearchSchema>;
