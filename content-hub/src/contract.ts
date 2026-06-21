import { z } from "zod";

// ── The seam ────────────────────────────────────────────────────────────────
// This is the ONLY thing the Hub and the app agree on. Every source adapter
// normalizes to a ContentItem; every sink knows how to deliver one. Nothing
// about Supabase, TanStack, or any specific content type leaks across this line,
// so either side can be swapped independently.

export const contentItemSchema = z.object({
  // Registry key of the feed, e.g. "vocabulary.en_vi", "news.vn", "recipes.vn".
  sourceKey: z.string().min(1).max(64),
  // Coarse kind the consumer renders by, e.g. "vocabulary", "news", "recipe".
  itemType: z.string().min(1).max(32),
  // Dedup key within the source (the queue upserts on (sourceKey, contentKey)).
  contentKey: z.string().min(1).max(128),
  // Type-specific body. Opaque to the transport; the consumer's renderer reads it.
  payload: z.record(z.string(), z.unknown()),
  // Optional: earliest moment the consumer may publish this item (ISO 8601).
  availableAt: z.string().datetime().optional(),
});

export type ContentItem = z.infer<typeof contentItemSchema>;

export function normalizeContentKey(key: string): string {
  return key.trim().toLowerCase();
}
