/**
 * Per-device reaction state — which words THIS browser hearted/bookmarked and
 * how many times each button was tapped — persisted in localStorage. Everything
 * is local and synchronous; there is no server dependency and no account.
 *
 * Exports: ReactionKind, REACTIONS_KEY, REACTIONS_EVENT, hasReaction, flipReaction,
 *   getTapCount, getReactionWordIds, getBookmarkedWordIds, getReactionSnapshot,
 *   getEmojiComments, addEmojiComment
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
 * `heartTaps`/`bookmarkTaps` are the reader's running totals — +1 when a reaction
 * turns on and -1 when it turns off, so un-tapping lowers the count (never below 0).
 * `savedAt`/`heartedAt` mark WHEN the reaction was last turned on, which is what the
 * saved page groups by day; they are cleared on un-tap so re-saving starts a fresh day.
 * `emojis` maps each emoji character the reader tapped to its cumulative count.
 */
export type ReactionEntry = {
  heart?: boolean;
  bookmark?: boolean;
  heartTaps?: number;
  bookmarkTaps?: number;
  heartedAt?: number;
  savedAt?: number;
  emojis?: Record<string, number>;
};

type ReactionStore = Record<string, ReactionEntry>;

/** Tap-counter field paired with each reaction kind. */
const TAP_FIELD: Record<ReactionKind, "heartTaps" | "bookmarkTaps"> = {
  heart: "heartTaps",
  bookmark: "bookmarkTaps",
};

/** Timestamp field paired with each reaction kind, recording the last time it was turned on. */
const DATE_FIELD: Record<ReactionKind, "heartedAt" | "savedAt"> = {
  heart: "heartedAt",
  bookmark: "savedAt",
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
      // Save dates are optional: records written before day grouping simply have none,
      // and the saved page then backfills or files the word under "Chưa xác định".
      const heartedAt = toCount(record.heartedAt);
      const savedAt = toCount(record.savedAt);
      // Legacy entries have an active flag but no counter: seed it at 1.
      if (heartTaps > 0) entry.heartTaps = heartTaps;
      else if (entry.heart) entry.heartTaps = 1;
      if (bookmarkTaps > 0) entry.bookmarkTaps = bookmarkTaps;
      else if (entry.bookmark) entry.bookmarkTaps = 1;
      // Only trust a date on a reaction that is actually still on.
      if (heartedAt > 0 && entry.heart) entry.heartedAt = heartedAt;
      if (savedAt > 0 && entry.bookmark) entry.savedAt = savedAt;
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
 * Toggle this device's reaction, persist it, and move the running total by one: +1
 * when the reaction turns on and -1 (clamped at 0) when it turns off, so the number
 * follows the reader's current reactions instead of only ever climbing.
 * Turning a reaction on also stamps the date field that the saved page groups by day;
 * turning it off clears the stamp, so re-saving a word records the new day.
 * @returns The new active state (true = reaction added).
 */
export function flipReaction(
  wordId: string,
  kind: ReactionKind,
  now: number = Date.now(),
): boolean {
  const store = readReactions();
  const entry: ReactionEntry = { ...(store[wordId] ?? {}) };
  const nextActive = entry[kind] !== true;
  if (nextActive) {
    entry[kind] = true;
    entry[TAP_FIELD[kind]] = toCount(entry[TAP_FIELD[kind]]) + 1;
    entry[DATE_FIELD[kind]] = now;
  } else {
    delete entry[kind];
    delete entry[DATE_FIELD[kind]];
    const remaining = Math.max(0, toCount(entry[TAP_FIELD[kind]]) - 1);
    if (remaining > 0) entry[TAP_FIELD[kind]] = remaining;
    else delete entry[TAP_FIELD[kind]];
  }
  if (Object.keys(entry).length > 0) store[wordId] = entry;
  else delete store[wordId];
  writeReactions(store);
  return nextActive;
}

/** Running local total for one word and reaction kind (0 when never tapped or fully un-tapped). */
export function getTapCount(wordId: string, kind: ReactionKind): number {
  return toCount(readReactions()[wordId]?.[TAP_FIELD[kind]]);
}

/**
 * Every word ID this device currently has the given reaction on, in the order the
 * reactions were written. Drives both saved-page tabs: `"bookmark"` for the words kept,
 * `"heart"` for the favourites.
 */
export function getReactionWordIds(kind: ReactionKind): string[] {
  return Object.entries(readReactions())
    .filter(([, entry]) => entry[kind] === true)
    .map(([id]) => id);
}

/** Convenience wrapper for the bookmark list (toolbar badge, saved page). */
export function getBookmarkedWordIds(): string[] {
  return getReactionWordIds("bookmark");
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
