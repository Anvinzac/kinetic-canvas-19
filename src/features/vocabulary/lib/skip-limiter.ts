/** Rate limit for forward scene skips in the feed. Exports: createSkipLimiter, sceneSkipLimiter, SKIP_BURST_LIMIT, SKIP_STREAK_GAP_MS, SKIP_COOLDOWN_MS. */

/** Consecutive skips allowed before the cooldown starts. */
export const SKIP_BURST_LIMIT = 3;
/** A gap longer than this between skips breaks the streak. */
export const SKIP_STREAK_GAP_MS = 4000;
/** How long further skips are silently ignored once the burst limit is hit. */
export const SKIP_COOLDOWN_MS = 15000;

export type SkipLimiter = {
  /** Record a skip attempt; false means it must be ignored. */
  tryConsume: (now?: number) => boolean;
};

/**
 * Build a limiter that allows `limit` skips in a row, then ignores every attempt for
 * `cooldownMs` measured from the last allowed one. Ignored attempts do not extend
 * the cooldown, so the wait stays predictable for a reader who keeps tapping.
 * @param options Burst size, streak gap and cooldown in ms
 * @returns Stateful limiter
 */
export function createSkipLimiter({
  limit = SKIP_BURST_LIMIT,
  gapMs = SKIP_STREAK_GAP_MS,
  cooldownMs = SKIP_COOLDOWN_MS,
}: { limit?: number; gapMs?: number; cooldownMs?: number } = {}): SkipLimiter {
  let streak = 0;
  let lastAt = Number.NEGATIVE_INFINITY;
  let blockedUntil = 0;
  return {
    tryConsume(now = Date.now()) {
      if (now < blockedUntil) return false;
      if (now - lastAt > gapMs) streak = 0;
      streak += 1;
      lastAt = now;
      if (streak >= limit) {
        blockedUntil = now + cooldownMs;
        streak = 0;
      }
      return true;
    },
  };
}

/** Shared across cards: a spelling-coda skip moves to the next card, which must not reset the count. */
export const sceneSkipLimiter = createSkipLimiter();
