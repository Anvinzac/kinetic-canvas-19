/**
 * Client-side resolution of this device's reacted words against the bundled catalog.
 * Pure lookups over localStorage plus the compiled deck — no server call, no auth,
 * no account.
 *
 * Exports: SavedWord, getWordsWithReaction, getSavedWords, getFavoriteWords,
 *   countWordsWithReaction, lookupWord
 * Depends on: ./catalog-source, ./schema, ./history, ./reactions
 */

import { catalogFor } from "./catalog-source";
import { resolveTarget } from "./target-language";
import type { VocabularyWord } from "./schema";
import { loadHistory } from "./history";
import { getReactionSnapshot, getReactionWordIds, type ReactionKind } from "./reactions";

/** Stable id → word index so reaction lookups never rescan the deck. */
// Resolved lazily: saved lists are per-address (localStorage), so the deck is this host's.
let byId: Map<string, VocabularyWord> | undefined;
function wordsByIdMap(): Map<string, VocabularyWord> {
  if (!byId) {
    const host = typeof window === "undefined" ? "" : window.location.host;
    byId = new Map(catalogFor(resolveTarget(host)).words.map((word) => [word.id, word]));
  }
  return byId;
}

/** One word on a saved page, plus the state that put it there. */
export type SavedWord = {
  word: VocabularyWord;
  hearted: boolean;
  bookmarked: boolean;
  /**
   * When the tab's own reaction was turned on, used to group the list by day. Undefined
   * for words saved before stamps existed and never viewed inside the rolling history
   * window, which files them under "Chưa xác định".
   */
  savedAt?: number;
};

/**
 * Pick the day to file a word under: its own stamp when it has one, otherwise the
 * earliest view time still held by the on-device history (a rolling week), otherwise
 * nothing. Backfilling from views only ever applies to pre-stamp records, so a word
 * saved today is never pushed into an older day.
 */
function resolveSavedAt(
  stamp: number | undefined,
  viewTimes: number[] | undefined,
): number | undefined {
  if (stamp) return stamp;
  if (!viewTimes?.length) return undefined;
  return Math.min(...viewTimes);
}

/** Resolve a catalog word by id (undefined when the deck no longer holds it). */
export function lookupWord(id: string): VocabularyWord | undefined {
  return wordsByIdMap().get(id);
}

/**
 * Every word this device has the given reaction on, in the order the reactions were
 * written. Words removed from the catalog after reacting are skipped silently, so a
 * stale localStorage id can never render an empty row.
 * @param kind - Which reaction defines the list membership
 * @returns Resolved words for that tab
 */
export function getWordsWithReaction(kind: ReactionKind): SavedWord[] {
  const history = loadHistory();
  const list: SavedWord[] = [];
  for (const id of getReactionWordIds(kind)) {
    const word = wordsByIdMap().get(id);
    if (!word) continue;
    const entry = getReactionSnapshot(id);
    list.push({
      word,
      hearted: entry.heart === true,
      bookmarked: entry.bookmark === true,
      savedAt: resolveSavedAt(kind === "bookmark" ? entry.savedAt : entry.heartedAt, history[id]),
    });
  }
  return list;
}

/** Words this device kept with the bookmark button — the "Đã lưu" tab. */
export function getSavedWords(): SavedWord[] {
  return getWordsWithReaction("bookmark");
}

/** Words this device hearted — the "Yêu thích" tab. */
export function getFavoriteWords(): SavedWord[] {
  return getWordsWithReaction("heart");
}

/** How many catalog words this device currently has on for one reaction. */
export function countWordsWithReaction(kind: ReactionKind): number {
  return getReactionWordIds(kind).filter((id) => wordsByIdMap().has(id)).length;
}
