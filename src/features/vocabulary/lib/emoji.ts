/**
 * Mocked community emoji totals per word, plus the palette those emojis come from.
 *
 * The feed is anonymous and file-backed, so there is no real per-word emoji
 * aggregate to read. These totals are deterministic per word id — the same word
 * always shows the same numbers, and a card replays its burst identically — while
 * differing between words so the stream does not look stamped.
 *
 * Deliberately a leaf module: it imports only ./random, never the catalog, so the
 * burst can be used without pulling the compiled deck into a chunk.
 *
 * Exports: EMOJI_PALETTE, PaletteEmoji, EmojiTotals, mockEmojiTotals,
 *          withLocalEmojis, burstGlyphs, clampBurstSpan, formatEmojiTotal
 * Depends on: ./random
 */

import { randomGenerator } from "./random";

/** The eight emojis a reader can leave on a word, and the burst draws from. */
export const EMOJI_PALETTE = ["🔥", "💡", "🤔", "❤️", "😂", "👏", "🎉", "💪"] as const;

export type PaletteEmoji = (typeof EMOJI_PALETTE)[number];

export type EmojiTotals = {
  /** Mocked community count per emoji. */
  counts: Record<string, number>;
  /** Sum of `counts`. */
  total: number;
  /** Emojis with a nonzero count, heaviest first — the burst leads with these. */
  ranked: { emoji: string; count: number }[];
};

/** Floor and span of the mocked aggregate, so totals look like a real crowd. */
const MIN_TOTAL = 24;
const TOTAL_SPREAD = 220;
/** Emojis that must carry a count, so no word bursts a single glyph repeated. */
const MIN_DISTINCT_EMOJIS = 3;

/** Span used when a caller cannot supply page timings. */
const DEFAULT_SPAN_SECONDS = 8;
/** Floor so a very short page span cannot compress the burst back into a clump. */
const MIN_SPAN_SECONDS = 3;
/** Glyphs launched per second of span. */
const GLYPHS_PER_SECOND = 2.2;
const MIN_GLYPHS = 12;
const MAX_GLYPHS = 26;
/** Share of the span spent launching; the remainder is flight and fade-out. */
const LAUNCH_WINDOW_SHARE = 0.66;
/** Share of the span one glyph is in flight, clamped to keep either end sane. */
const FLIGHT_SHARE = 0.34;
const MIN_FLIGHT_SECONDS = 1.6;
const MAX_FLIGHT_SECONDS = 4.5;

/**
 * Build a word's mocked emoji aggregate.
 * @param wordId Stable catalog word id
 * @returns Per-emoji counts, their total, and the ranking used by the burst
 * @pure true
 */
export function mockEmojiTotals(wordId: string): EmojiTotals {
  const random = randomGenerator(`emoji-totals:${wordId}`);
  const total = MIN_TOTAL + Math.floor(random() * TOTAL_SPREAD);
  // Squaring the draw skews the spread so one or two emojis dominate, which is how
  // real reaction tallies look; a uniform split would read as generated noise.
  const weights = EMOJI_PALETTE.map(() => {
    const draw = random();
    return draw * draw;
  });
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0) || 1;

  const counts: Record<string, number> = {};
  let allocated = 0;
  EMOJI_PALETTE.forEach((emoji, index) => {
    const count = Math.floor((weights[index]! / weightSum) * total);
    counts[emoji] = count;
    allocated += count;
  });

  // Hand the rounding remainder to the heaviest emojis, then guarantee a minimum
  // spread so the burst always has variety to fly.
  const rankedOrder = EMOJI_PALETTE.map((emoji, index) => ({ emoji, index }))
    .sort((a, b) => weights[b.index]! - weights[a.index]!)
    .map((entry) => entry.emoji);
  let remainder = total - allocated;
  for (let cursor = 0; remainder > 0; cursor = (cursor + 1) % rankedOrder.length) {
    const emoji = rankedOrder[cursor]!;
    counts[emoji] = (counts[emoji] ?? 0) + 1;
    remainder -= 1;
  }
  for (let cursor = 0; cursor < rankedOrder.length; cursor++) {
    const filled = rankedOrder.filter((emoji) => (counts[emoji] ?? 0) > 0).length;
    if (filled >= MIN_DISTINCT_EMOJIS) break;
    const emoji = rankedOrder[cursor]!;
    if ((counts[emoji] ?? 0) > 0) continue;
    counts[emoji] = 1 + Math.floor(random() * 3);
  }

  const ranked = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([emoji, count]) => ({ emoji, count }))
    .sort((a, b) => b.count - a.count);

  return {
    counts,
    total: ranked.reduce((sum, entry) => sum + entry.count, 0),
    ranked,
  };
}

/**
 * Fold this device's own emoji taps on top of the mocked aggregate, so a reader's
 * taps visibly add to the crowd rather than being tracked separately.
 * @param totals Mocked aggregate
 * @param local Per-emoji counts from the local reaction store
 * @returns A merged aggregate in the same shape
 * @pure true
 */
export function withLocalEmojis(totals: EmojiTotals, local: Record<string, number>): EmojiTotals {
  const counts: Record<string, number> = { ...totals.counts };
  for (const [emoji, count] of Object.entries(local)) {
    if (count > 0) counts[emoji] = (counts[emoji] ?? 0) + count;
  }
  const ranked = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([emoji, count]) => ({ emoji, count }))
    .sort((a, b) => b.count - a.count);
  return { counts, total: ranked.reduce((sum, entry) => sum + entry.count, 0), ranked };
}

/**
 * One glyph in a burst: which emoji, which side it billows to, and how it drifts.
 *
 * The flight is modelled on smoke rather than on confetti: a puff leaves the
 * reaction button small, rises while decelerating, widens sideways away from the
 * centre line, and dissipates by growing and fading instead of falling.
 */
export type BurstGlyph = {
  key: string;
  emoji: string;
  /** -1 billows toward the left edge, +1 toward the right. */
  side: -1 | 1;
  /** 0-1 share of the card width the glyph drifts outward from the launch point. */
  lateral: number;
  /** 0-1 share of the card height the glyph climbs. */
  rise: number;
  /** Pixels the path bends mid-flight, signed, so plumes do not travel in straight lines. */
  wobble: number;
  /** Seconds before this glyph launches. */
  delay: number;
  /** Seconds the glyph is in flight. */
  duration: number;
  /** Rendered size in em at launch. */
  scale: number;
  /** Multiplier on `scale` at landing — smoke expands as it dissipates. */
  billow: number;
};

/**
 * Clamp a caller-supplied span into the range the burst timings are tuned for, so
 * an unusually short or long page span cannot compress the flight into a clump or
 * stretch it past the card's lifetime.
 * @param seconds Span the caller wants the burst to fill
 * @returns A usable span in seconds
 * @pure true
 */
export function clampBurstSpan(seconds: number): number {
  return Math.max(MIN_SPAN_SECONDS, Number.isFinite(seconds) ? seconds : DEFAULT_SPAN_SECONDS);
}

/**
 * Apportion the glyph budget across emojis by each one's OWN count, using the
 * largest-remainder method so the shares sum exactly to `limit` and every emoji
 * that carries a count flies at least once.
 *
 * Drawing glyphs by weighted random sampling (the previous behaviour) only
 * reproduces the aggregate statistically, so a word could burst six 🔥 and zero 👏
 * while the chip row claimed 👏 had a count. Allocating deterministically makes the
 * flight agree with the numbers on screen, which is what "realistic" means here.
 * @param entries Emojis with a nonzero count, heaviest first
 * @param limit Total glyphs to launch
 * @returns One glyph count per entry, in the same order
 * @pure true
 */
function allocateGlyphSlots(entries: { emoji: string; count: number }[], limit: number): number[] {
  const weightSum = entries.reduce((sum, entry) => sum + entry.count, 0) || 1;
  const exact = entries.map((entry) => (entry.count / weightSum) * limit);
  const slots = exact.map((share) => Math.floor(share));

  // Hand out the remainder by largest fractional share, then guarantee presence.
  const order = exact
    .map((share, index) => ({ index, frac: share - Math.floor(share) }))
    .sort((a, b) => b.frac - a.frac);
  let used = slots.reduce((sum, value) => sum + value, 0);
  for (let cursor = 0; used < limit; cursor = (cursor + 1) % order.length) {
    slots[order[cursor]!.index] = (slots[order[cursor]!.index] ?? 0) + 1;
    used += 1;
  }
  for (let index = 0; index < slots.length; index++) {
    if ((slots[index] ?? 0) > 0) continue;
    // Steal from whoever currently flies the most, so the sum stays at `limit`.
    const donor = slots.reduce(
      (best, value, i) => (value > (slots[best] ?? 0) && value > 1 ? i : best),
      0,
    );
    if ((slots[donor] ?? 0) > 1) {
      slots[donor] = (slots[donor] ?? 0) - 1;
      slots[index] = 1;
    }
  }
  return slots;
}

/**
 * Expand a word's aggregate into the glyphs to fly, each emoji contributing in
 * proportion to its own count. Deterministic per word and replay.
 *
 * Launches are spread evenly across most of `spanSeconds` rather than fired at
 * once, so the stream of glyphs keeps arriving while the spelling coda runs and
 * the last flight lands about as the word leaves.
 * @param totals Aggregate to visualize
 * @param wordId Stable seed material
 * @param options Span to fill, in seconds, and an optional glyph cap
 * @returns Glyphs in launch order
 * @pure true
 */
export function burstGlyphs(
  totals: EmojiTotals,
  wordId: string,
  options: { spanSeconds?: number; limit?: number } = {},
): BurstGlyph[] {
  if (!totals.ranked.length) return [];
  const span = clampBurstSpan(options.spanSeconds ?? DEFAULT_SPAN_SECONDS);
  // A longer span earns more glyphs, bounded so a short span is not sparse and a
  // long one does not turn into a wall of animation.
  const limit =
    options.limit ??
    Math.min(MAX_GLYPHS, Math.max(MIN_GLYPHS, Math.round(span * GLYPHS_PER_SECOND)));
  const random = randomGenerator(`emoji-burst:${wordId}`);
  const slot = (span * LAUNCH_WINDOW_SHARE) / limit;
  const flight = Math.min(MAX_FLIGHT_SECONDS, Math.max(MIN_FLIGHT_SECONDS, span * FLIGHT_SHARE));
  const slots = allocateGlyphSlots(totals.ranked, limit);

  // Spread each emoji's allotment evenly over the launch window instead of letting a
  // heavily-reacted glyph fire its whole count in one clump.
  const queue: { emoji: string; position: number }[] = [];
  totals.ranked.forEach((entry, entryIndex) => {
    const share = slots[entryIndex] ?? 0;
    if (share <= 0) return;
    for (let copy = 0; copy < share; copy++) {
      queue.push({ emoji: entry.emoji, position: ((copy + 0.5) * limit) / share });
    }
  });
  queue.sort((a, b) => a.position - b.position);

  return queue.map((entry, index) => {
    // Alternate sides, with one seeded flip so the split is not a perfect left/right
    // mirror. Two sides is the whole point: the plume opens outward from the button.
    const side: -1 | 1 = (index + (random() < 0.5 ? 1 : 0)) % 2 === 0 ? -1 : 1;
    return {
      key: `${index}-${entry.emoji}`,
      emoji: entry.emoji,
      side,
      // Small outward drift growing to the card edge, and a climb that decelerates.
      lateral: 0.16 + random() * 0.4,
      rise: 0.34 + random() * 0.46,
      wobble: (random() - 0.5) * 46,
      // Even slots plus bounded jitter: gradual, but never two glyphs at once.
      delay: index * slot + random() * slot * 0.5,
      duration: flight * (0.9 + random() * 0.35),
      // Starts as a puff at the button and ends larger and transparent: dissipation.
      scale: 0.55 + random() * 0.4,
      billow: 1.5 + random() * 0.7,
    };
  });
}

/** Compact crowd-style count label. @param value Total. @returns e.g. "1.2k". @pure true */
export function formatEmojiTotal(value: number): string {
  if (value < 1000) return String(value);
  const thousands = value / 1000;
  return `${thousands >= 10 ? Math.round(thousands) : thousands.toFixed(1).replace(/\.0$/, "")}k`;
}
