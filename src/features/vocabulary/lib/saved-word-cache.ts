/**
 * On-device copies of the words this device has reacted to.
 *
 * The deck is server-only: no client bundle carries it, and there is no endpoint that
 * resolves word ids (they are headwords, so such an endpoint would be an enumeration API
 * by another name). The saved pages therefore keep their own copy of each word, taken
 * from the card at the moment the reader hearts or bookmarks it. The reader only ever
 * holds words the feed already showed them.
 *
 * Entries outlive the reaction briefly, so an undo right after a removal still finds its
 * word, and are pruned to the reacted set plus a few recent extras on every write.
 *
 * Exports: SAVED_WORDS_KEY, rememberWord, cachedWord, cachedWordIds
 * Depends on: ./schema (types), ./reactions
 */

import type { VocabularyWord } from "./schema";
import { getReactionWordIds } from "./reactions";

/** localStorage key for the word copies; namespaced next to the reaction store. */
export const SAVED_WORDS_KEY = "kinetic.vocab.saved-words";

/** Words kept past the end of their reactions, newest first, for undo. */
const SPARE_ENTRIES = 20;

type CacheEntry = { word: VocabularyWord; at: number };
type WordCache = Record<string, CacheEntry>;

function readCache(): WordCache {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SAVED_WORDS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as WordCache)
      : {};
  } catch {
    return {};
  }
}

function writeCache(cache: WordCache): void {
  try {
    window.localStorage.setItem(SAVED_WORDS_KEY, JSON.stringify(cache));
  } catch {
    // Storage full or blocked: the reaction itself still lands, only the copy is lost.
  }
}

/**
 * Keep a copy of a word the reader just reacted to.
 * @param word - the word as the card rendered it
 * @param now - stamp for pruning order, for tests
 */
export function rememberWord(word: VocabularyWord, now: number = Date.now()): void {
  if (typeof window === "undefined" || !word.id) return;
  const cache = readCache();
  cache[word.id] = { word, at: now };
  const active = new Set([...getReactionWordIds("bookmark"), ...getReactionWordIds("heart")]);
  active.add(word.id);
  const spare = Object.entries(cache)
    .filter(([id]) => !active.has(id))
    .sort(([, a], [, b]) => b.at - a.at)
    .slice(SPARE_ENTRIES);
  for (const [id] of spare) delete cache[id];
  writeCache(cache);
}

/** The stored copy of one word, or undefined when this device never kept it. */
export function cachedWord(id: string): VocabularyWord | undefined {
  const entry = readCache()[id];
  return entry && typeof entry.word === "object" ? entry.word : undefined;
}

/** Every id this device holds a copy of. */
export function cachedWordIds(): Set<string> {
  return new Set(Object.keys(readCache()));
}
