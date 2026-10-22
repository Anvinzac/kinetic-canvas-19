/**
 * Client-side resolution of this device's reacted words against the copies it kept when
 * the reader reacted (./saved-word-cache). Pure localStorage reads — no server call, no
 * auth, no account, and no deck: the catalog never ships to the browser.
 *
 * Exports: SavedWord, getWordsWithReaction, getSavedWords, getFavoriteWords,
 *   countWordsWithReaction
 * Depends on: ./schema, ./history, ./reactions, ./saved-word-cache
 */

import type { VocabularyWord } from "./schema";
import { loadHistory } from "./history";
import { getReactionSnapshot, getReactionWordIds, type ReactionKind } from "./reactions";
import { cachedWord, cachedWordIds } from "./saved-word-cache";

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

/**
 * Every word this device has the given reaction on, in the order the reactions were
 * written. A reaction with no kept copy (one made before copies were kept) is skipped
 * silently, so a stale localStorage id can never render an empty row.
 * @param kind - Which reaction defines the list membership
 * @returns Resolved words for that tab
 */
export function getWordsWithReaction(kind: ReactionKind): SavedWord[] {
  const history = loadHistory();
  const list: SavedWord[] = [];
  for (const id of getReactionWordIds(kind)) {
    const word = cachedWord(id);
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

/** How many kept words this device currently has on for one reaction. */
export function countWordsWithReaction(kind: ReactionKind): number {
  const kept = cachedWordIds();
  return getReactionWordIds(kind).filter((id) => kept.has(id)).length;
}
