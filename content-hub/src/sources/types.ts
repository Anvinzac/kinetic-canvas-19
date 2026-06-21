import type { ContentItem } from "../contract.ts";
import type { Logger } from "../logger.ts";

export interface ProduceContext {
  log: Logger;
}

// Implement one of these per content type. Adding news/recipes/jobs = adding a
// file that implements this interface and registering it — nothing else changes.
export interface SourceAdapter {
  /** Registry key, e.g. "vocabulary.en_vi". Must match an agent_content_sources row. */
  readonly sourceKey: string;
  /** Coarse kind the consumer renders by, e.g. "vocabulary". */
  readonly itemType: string;
  /**
   * Produce up to `count` fresh, normalized items. The queue dedups on
   * (sourceKey, contentKey), so returning an occasional repeat is harmless —
   * adapters should aim for novelty but never need perfect local memory.
   */
  produce(count: number, ctx: ProduceContext): Promise<ContentItem[]>;
}
