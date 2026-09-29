/**
 * Server-paging bounds for the vocabulary stream backfill.
 *
 * The feed endpoint permutes the same matching pool forever — `nextPosition` only
 * turns null at MAX_POSITION — so `hasNextPage` can never be the signal that stops
 * a backfill. These bounds answer the only question that matters: can the next page
 * still contain a word this stream has not been offered yet?
 *
 * Exports: VOCAB_PAGE_LIMIT, VOCAB_MAX_PAGES, getWalkedPositions, canWalkFurther
 * Depends on: types (FeedEntry)
 */

import type { FeedEntry } from "../types";

/** Entries requested per feed page (see api/feed.ts). */
export const VOCAB_PAGE_LIMIT = 12;

/** Pages retained by the infinite query (see hooks/useVocabularyFeed.ts). */
export const VOCAB_MAX_PAGES = 10;

/**
 * How far the stream has walked through server positions.
 * @param entries - Buffered entries, in server order.
 * @returns Positions already offered (0 when nothing is buffered).
 */
export function getWalkedPositions(entries: readonly FeedEntry[]): number {
  const last = entries[entries.length - 1];
  return last ? last.position + 1 : 0;
}

/**
 * Decide whether another page can still pay off.
 *
 * One full pass over the pool shows every word the filters match, so a page beyond
 * `matching + VOCAB_PAGE_LIMIT` positions (one cycle plus a page of slack for the
 * eviction boundary) can only repeat words already offered. The walk is additionally
 * capped at what the local buffer retains, because `maxPages` drops those earlier
 * positions anyway — without the cap, a fully blocked stream re-fetches the same
 * blocked cycle hundreds of times a second.
 * @param matching - Pool size reported by the server (0 when unknown).
 * @param walkedPositions - Server positions already buffered.
 * @returns True while a further page can still contain an unseen word.
 */
export function canWalkFurther(matching: number, walkedPositions: number): boolean {
  const bufferCeiling = VOCAB_PAGE_LIMIT * VOCAB_MAX_PAGES;
  const cycleCeiling = matching > 0 ? matching + VOCAB_PAGE_LIMIT : bufferCeiling;
  return walkedPositions < Math.min(bufferCeiling, cycleCeiling);
}
