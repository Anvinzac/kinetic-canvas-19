/**
 * Per-device reaction state — which words THIS browser hearted/bookmarked and
 * how many times each button was tapped — persisted in localStorage. Everything
 * is local and synchronous; there is no server dependency and no account.
 *
 * Exports: ReactionKind, REACTIONS_KEY, REACTIONS_EVENT, hasReaction, flipReaction,
 *   getTapCount, getBookmarkedWordIds, getReactionSnapshot, getEmojiComments,
 *   addEmojiComment
 * Depends on: none (leaf module, SSR-safe like demo-session)
 */

export type ReactionKind = "heart" | "bookmark";

/** localStorage key; exported so hooks can listen for cross-tab storage events. */
export const REACTIONS_KEY = "kinetic.vocab.reactions";

/**
 * Window event fired after every local write. The native `storage` event only
 * reaches OTHER tabs, so without this the toolbar badge and any mounted list
 * would stay stale until the window was refocused.
 */
export const REACTIONS_EVENT = "kinetic:vocab-reactions";

/**
 * One word's reaction record. `heart`/`bookmark` are the current toggle state;
 * `heartTaps`/`bookmarkTaps` are cumulative tap counters that never decrease.
 * `emojis` maps each emoji character the reader tapped to its cumulative count.
 */
export type ReactionEntry = {
  heart?: boolean;
  bookmark?: boolean;
  heartTaps?: number;
  bookmarkTaps?: number;
  emojis?: Record<string, number>;
};

type ReactionStore = Record<string, ReactionEntry>;

/** Tap-counter field paired with each reaction kind. */
const TAP_FIELD: Record<ReactionKind, "heartTaps" | "bookmarkTaps"> = {
  heart: "heartTaps",
  bookmark: "bookmarkTaps",
};

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function toCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * Read the store, migrating legacy `{ heart: true }` records (boolean-only,
 * no counters) into the current shape so old devices keep their reactions.
 */
export function readReactions(): ReactionStore {
  const raw = getStorage()?.getItem(REACTIONS_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const store: ReactionStore = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const record = value as Record<string, unknown>;
      const entry: ReactionEntry = {};
      if (record.heart === true) entry.heart = true;
      if (record.bookmark === true) entry.bookmark = true;
      const heartTaps = toCount(record.heartTaps);
      const bookmarkTaps = toCount(record.bookmarkTaps);
      // Legacy entries have an active flag but no counter: seed it at 1.
      if (heartTaps > 0) entry.heartTaps = heartTaps;
      else if (entry.heart) entry.heartTaps = 1;
      if (bookmarkTaps > 0) entry.bookmarkTaps = bookmarkTaps;
      else if (entry.bookmark) entry.bookmarkTaps = 1;
      // Emoji comments: carry over any { emoji: count } map from the raw record.
      if (record.emojis && typeof record.emojis === "object") {
        const emojis: Record<string, number> = {};
        for (const [ch, n] of Object.entries(record.emojis as Record<string, unknown>)) {
          const count = toCount(n);
          if (count > 0) emojis[ch] = count;
        }
        if (Object.keys(emojis).length > 0) entry.emojis = emojis;
      }
      if (Object.keys(entry).length > 0) store[id] = entry;
    }
    return store;
  } catch {
    return {};
  }
}

function writeReactions(store: ReactionStore): void {
  try {
    getStorage()?.setItem(REACTIONS_KEY, JSON.stringify(store));
  } catch {
    // Quota or privacy mode — reactions simply stay in memory for this session.
  }
  // Notify same-tab listeners even when persistence failed, so the UI still
  // reflects the state the reader just asked for.
  if (typeof window !== "undefined") window.dispatchEvent(new Event(REACTIONS_EVENT));
}

/** Whether this device currently has the reaction toggled on for the word. */
export function hasReaction(wordId: string, kind: ReactionKind): boolean {
  return readReactions()[wordId]?.[kind] === true;
}

/**
 * Toggle this device's reaction, persist it, and bump the tap counter when the
 * reaction turns on. Counters never decrease, so un-tapping keeps the history.
 * @returns The new active state (true = reaction added).
 */
export function flipReaction(wordId: string, kind: ReactionKind): boolean {
  const store = readReactions();
  const entry: ReactionEntry = { ...(store[wordId] ?? {}) };
  const nextActive = entry[kind] !== true;
  if (nextActive) {
    entry[kind] = true;
    entry[TAP_FIELD[kind]] = toCount(entry[TAP_FIELD[kind]]) + 1;
  } else {
    delete entry[kind];
  }
  if (Object.keys(entry).length > 0) store[wordId] = entry;
  else delete store[wordId];
  writeReactions(store);
  return nextActive;
}

/** Cumulative local taps for one word and reaction kind (0 when never tapped). */
export function getTapCount(wordId: string, kind: ReactionKind): number {
  return toCount(readReactions()[wordId]?.[TAP_FIELD[kind]]);
}

/** Every word ID this device currently has bookmarked, in storage order. */
export function getBookmarkedWordIds(): string[] {
  return Object.entries(readReactions())
    .filter(([, entry]) => entry.bookmark === true)
    .map(([id]) => id);
}

/** Full per-word reaction record, for pages that need flags and counts together. */
export function getReactionSnapshot(wordId: string): ReactionEntry {
  return readReactions()[wordId] ?? {};
}

/**
 * Every emoji comment this device left on the word, as a { emoji: count } map.
 * Returns an empty object when no emoji has been tapped yet.
 */
export function getEmojiComments(wordId: string): Record<string, number> {
  return readReactions()[wordId]?.emojis ?? {};
}

/**
 * Add one tap of the given emoji to the word's comment list, persist, and
 * notify same-tab listeners. The count is cumulative and never decreases.
 */
export function addEmojiComment(wordId: string, emoji: string): void {
  const store = readReactions();
  const entry: ReactionEntry = { ...(store[wordId] ?? {}) };
  const emojis = { ...(entry.emojis ?? {}) };
  emojis[emoji] = (emojis[emoji] ?? 0) + 1;
  entry.emojis = emojis;
  store[wordId] = entry;
  writeReactions(store);
}
