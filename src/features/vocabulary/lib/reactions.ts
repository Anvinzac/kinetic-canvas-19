/**
 * Per-device reaction state (which words THIS browser hearted/bookmarked),
 * persisted in localStorage so taps toggle instead of double-counting.
 * Totals across all viewers live server-side in engagement.json.
 *
 * Exports: ReactionKind, hasReaction, flipReaction
 * Depends on: none (leaf module, SSR-safe like demo-session)
 */

export type ReactionKind = "heart" | "bookmark";

const STORAGE_KEY = "kinetic.vocab.reactions";

type ReactionStore = Record<string, Partial<Record<ReactionKind, true>>>;

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function readStore(): ReactionStore {
  const raw = getStorage()?.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ReactionStore;
  } catch {
    return {};
  }
}

function writeStore(store: ReactionStore): void {
  getStorage()?.setItem(STORAGE_KEY, JSON.stringify(store));
}

/** Whether this device already reacted to the word with the given kind. */
export function hasReaction(wordId: string, kind: ReactionKind): boolean {
  return readStore()[wordId]?.[kind] === true;
}

/**
 * Toggle this device's reaction and persist it.
 * @returns The new active state (true = reaction added).
 */
export function flipReaction(wordId: string, kind: ReactionKind): boolean {
  const store = readStore();
  const entry = { ...(store[wordId] ?? {}) };
  const nextActive = entry[kind] !== true;
  if (nextActive) entry[kind] = true;
  else delete entry[kind];
  if (Object.keys(entry).length > 0) store[wordId] = entry;
  else delete store[wordId];
  writeStore(store);
  return nextActive;
}
