/**
 * Spelling-coda variant catalogue and timing. Pure and framework-free so the
 * component, the card and any regression script share one source of truth.
 *
 * Exports: SPELLING_VARIANTS, SpellingVariant, SPELLING_STAGGER,
 *   SPELLING_HOLD_SECONDS, pickSpellingVariant, getSpellingDurationMs,
 *   SPELLING_NOMINAL_FONT_SIZE, SPELLING_FIT_GUARD, getSpellingFitFontSize
 * Depends on: none (leaf module)
 */

/** The eight post-reveal letter animations, in the order they were designed. */
export const SPELLING_VARIANTS = [
  "bounce",
  "drop",
  "spin",
  "scatter",
  "wave",
  "flip",
  "elastic",
  "slide",
] as const;

export type SpellingVariant = (typeof SPELLING_VARIANTS)[number];

/** Seconds between consecutive letters for each variant. */
export const SPELLING_STAGGER: Record<SpellingVariant, number> = {
  bounce: 0.38,
  drop: 0.35,
  spin: 0.4,
  scatter: 0.32,
  wave: 0.3,
  flip: 0.38,
  elastic: 0.36,
  slide: 0.34,
};

/** Seconds the last letter takes to settle before the hold starts. */
export const SPELLING_SETTLE_SECONDS = 1;

/** Seconds the fully spelled word stays on screen before the stream advances. */
export const SPELLING_HOLD_SECONDS = 3;

/** Reduced-motion readers get a static word plus a short reading beat. */
export const SPELLING_REDUCED_MOTION_MS = 3000;

/** Letter-row size before the fit pass scales it down for long answers. */
export const SPELLING_NOMINAL_FONT_SIZE = 96;

/** Keep the row inside the safe area even at peak animation overshoot. */
export const SPELLING_FIT_GUARD = 0.86;

/**
 * Solve the letter-row font size that keeps the whole answer on ONE line.
 *
 * The row cannot wrap (`.vocab-spelling-word` is `flex-wrap: nowrap`), so the size
 * is the only degree of freedom left and it has to absorb any length. There is
 * deliberately no lower clamp: a minimum is what used to pin a long answer at an
 * unshrinkable size and let it spill past the card, which is the failure this
 * function exists to make impossible.
 * @param naturalWidth Letter-row width measured at SPELLING_NOMINAL_FONT_SIZE.
 * @param availableWidth Card width already discounted by SPELLING_FIT_GUARD.
 * @returns Font size in px; never above nominal, and never clamped from below.
 */
export function getSpellingFitFontSize(naturalWidth: number, availableWidth: number): number {
  if (!(naturalWidth > 0) || !(availableWidth > 0)) return SPELLING_NOMINAL_FONT_SIZE;
  const scaled = (availableWidth / naturalWidth) * SPELLING_NOMINAL_FONT_SIZE;
  return scaled > 0 && Number.isFinite(scaled)
    ? Math.min(SPELLING_NOMINAL_FONT_SIZE, scaled)
    : SPELLING_NOMINAL_FONT_SIZE;
}

/**
 * Deterministic variant choice so a card replays the same motion on re-render
 * while neighbouring cards in the stream still differ.
 * @param seed Stable per-occurrence string. @returns One of the eight variants.
 */
export function pickSpellingVariant(seed: string): SpellingVariant {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return SPELLING_VARIANTS[Math.abs(hash) % SPELLING_VARIANTS.length]!;
}

/**
 * How long the spelling phase occupies, in milliseconds. The card feeds this to
 * the playback timer so timing is owned in exactly one place.
 * @param word Revealed answer. @param variant Chosen motion. @param reducedMotion Preference. @returns Phase length in ms.
 */
export function getSpellingDurationMs(
  word: string,
  variant: SpellingVariant,
  reducedMotion: boolean,
): number {
  if (reducedMotion) return SPELLING_REDUCED_MOTION_MS;
  // Array.from keeps surrogate pairs whole, matching the component's split.
  const letters = Array.from(word).length;
  return Math.round(
    (letters * SPELLING_STAGGER[variant] + SPELLING_SETTLE_SECONDS + SPELLING_HOLD_SECONDS) * 1000,
  );
}
