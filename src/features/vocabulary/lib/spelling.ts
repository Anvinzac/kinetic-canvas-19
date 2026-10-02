/**
 * Spelling-coda variant catalogue and timing. Pure and framework-free so the
 * component, the card and any regression script share one source of truth.
 *
 * Exports: SPELLING_VARIANTS, SpellingVariant, SPELLING_STAGGER,
 *   SPELLING_HOLD_SECONDS, pickSpellingVariant, getSpellingDurationMs
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
