/**
 * Client-side resolution of this device's bookmarked words against the bundled
 * catalog. Pure lookups over localStorage plus the compiled deck — no server
 * call, no auth, no account.
 *
 * Exports: SavedWord, getSavedWords, countSavedWords, lookupWord
 * Depends on: ../data/catalog.json, ./schema, ./reactions
 */

import rawCatalog from "../data/catalog.json";
import type { Catalog, VocabularyWord } from "./schema";
import { getBookmarkedWordIds, getReactionSnapshot } from "./reactions";

const catalog = rawCatalog as Catalog;

/** Stable id → word index so bookmark lookups never rescan the deck. */
const wordsById = new Map<string, VocabularyWord>(catalog.words.map((word) => [word.id, word]));

/** One bookmarked word plus this device's local reaction state for it. */
export type SavedWord = {
  word: VocabularyWord;
  hearted: boolean;
  heartTaps: number;
  bookmarkTaps: number;
  emojis: Record<string, number>;
};

/** Resolve a catalog word by id (undefined when the deck no longer holds it). */
export function lookupWord(id: string): VocabularyWord | undefined {
  return wordsById.get(id);
}

/**
 * Every word this device bookmarked, with its local tap counters. Words that
 * were removed from the catalog after bookmarking are skipped silently.
 * @returns Saved words in the order the device bookmarked them.
 */
export function getSavedWords(): SavedWord[] {
  const saved: SavedWord[] = [];
  for (const id of getBookmarkedWordIds()) {
    const word = wordsById.get(id);
    if (!word) continue;
    const entry = getReactionSnapshot(id);
    saved.push({
      word,
      hearted: entry.heart === true,
      heartTaps: entry.heartTaps ?? 0,
      bookmarkTaps: entry.bookmarkTaps ?? 0,
      emojis: entry.emojis ?? {},
    });
  }
  return saved;
}

/** How many words this device currently has bookmarked (badge count). */
export function countSavedWords(): number {
  return getBookmarkedWordIds().filter((id) => wordsById.has(id)).length;
}
