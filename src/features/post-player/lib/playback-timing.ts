/**
 * Feed-player tempo, page duration, and text sizing helpers (not KineticText preview tempo).
 *
 * Exports: tempoConfig, TEXT_SAFE_*, fit constants, getPageDuration, getWordDelay, getUniformPageTextSize, isSoloTextPage
 * Depends on: features/canvas Tempo/Rhythm, features/kinetic-text getWords/isLikelyVietnameseText
 */

import type { Rhythm, Tempo } from "@/features/canvas";
import { getWords, isLikelyVietnameseText } from "@/features/kinetic-text";

/** Keep kinetic text clear of the canvas edge without stealing its scale. */
export const TEXT_SAFE_MAX_WIDTH = "min(92%, calc(100% - 2rem))";
export const TEXT_SAFE_TOP_PX = 72;
export const TEXT_SAFE_BOTTOM_PX = 132;
export const MIN_TEXT_FIT_SCALE = 0.46;
export const MIN_ENGLISH_TEXT_FIT_SCALE = 0.72;
export const EMPHASIS_SCALE_FIT_GUARD = 1.14;
// Emphasized words render this many times larger than the base font. Applied via
// fontSize (not transform: scale) so the extra width occupies real layout space.
export const EMPHASIS_FONT_SCALE = 1.12;
export const VIETNAMESE_SCALE_FIT_GUARD = 1.24;
export const MIN_FONT_SIZE = 64;

// Feed player tempo — shape and wordDelay/wordDuration diverge from KineticText's
// preview tempoConfig ({ duration, wordDelay, loopSeconds }). loopSeconds stay
// aligned with shared TEMPO_LOOP_SECONDS / getLoopAnimation; do not unify the rest.
export const tempoConfig: Record<
  Tempo,
  { pageMultiplier: number; wordDelay: number; wordDuration: number; loopSeconds: number }
> = {
  slow: { pageMultiplier: 1.22, wordDelay: 0.25, wordDuration: 0.72, loopSeconds: 3.4 },
  steady: { pageMultiplier: 1, wordDelay: 0.18, wordDuration: 0.5, loopSeconds: 2.4 },
  snappy: { pageMultiplier: 0.78, wordDelay: 0.1, wordDuration: 0.36, loopSeconds: 1.45 },
};

/**
 * Check isSoloTextPage.
 * @param text - text argument
 * @returns Boolean result
 */
export function isSoloTextPage(text: string): boolean {
  return getWords(text).length <= 1;
}

/**
 * Compute uniformpagetextsize.
 * @param baseSize - baseSize argument
 * @param pages - pages argument
 * @param fullText - fullText argument
 * @returns Computed value
 */
export function getUniformPageTextSize(baseSize: number, pages: string[], fullText: string): number {
  // Single page: use its optimal size
  if (pages.length <= 1) {
    return Math.max(
      MIN_FONT_SIZE,
      getPageTextSize(baseSize, pages[0] ?? "", isLikelyVietnameseText(fullText)),
    );
  }

  // Multi-page: find the SMALLEST page (fewest words) to determine a uniform
  // size that works for all. This makes all pages display large and consistent.
  // Never shrinks below MIN_FONT_SIZE.
  const isVietnamese = isLikelyVietnameseText(fullText);
  const minWordCount = Math.min(...pages.map((p) => getWords(p).length));

  let size: number;
  if (isVietnamese) {
    if (minWordCount >= 9) size = Math.min(baseSize, 78);
    else if (minWordCount >= 7) size = Math.min(baseSize, 84);
    else if (minWordCount >= 5) size = Math.min(baseSize, 92);
    else if (minWordCount >= 3) size = Math.min(baseSize, 104);
    else size = baseSize;
  } else {
    // English: bump size based on min word count (smaller pages get larger fonts)
    if (minWordCount >= 14) size = Math.max(baseSize, 80);
    else if (minWordCount >= 10) size = Math.max(baseSize, 86);
    else if (minWordCount >= 6) size = Math.max(baseSize, 92);
    else size = Math.max(baseSize, 96);
  }

  return Math.max(MIN_FONT_SIZE, size);
}

/**
 * Compute pagetextsize.
 * @param baseSize - baseSize argument
 * @param text - text argument
 * @param isVietnamese - isVietnamese argument
 * @returns Computed value
 */
export function getPageTextSize(baseSize: number, text: string, isVietnamese: boolean): number {
  const wordCount = getWords(text).length;
  if (isVietnamese) {
    if (wordCount >= 9) return Math.min(baseSize, 78);
    if (wordCount >= 7) return Math.min(baseSize, 84);
    if (wordCount >= 5) return Math.min(baseSize, 92);
    if (wordCount >= 3) return Math.min(baseSize, 104);
    return baseSize;
  }
  // English text: bump base size so it fills the canvas like Vietnamese posts.
  if (wordCount >= 14) return Math.max(baseSize, 80);
  if (wordCount >= 10) return Math.max(baseSize, 86);
  if (wordCount >= 6) return Math.max(baseSize, 92);
  return Math.max(baseSize, 96);
}

/**
 * Compute pageduration.
 * @param text - text argument
 * @param tempo - tempo argument
 * @param rhythm - rhythm argument
 * @returns Computed value
 */
export function getPageDuration(text: string, tempo: Tempo, rhythm: Rhythm): number {
  const wordCount = getWords(text).length;
  const base = Math.max(3200, Math.min(5200, 1900 + wordCount * 430));
  const rhythmMultiplier = rhythm === "poetic" ? 1.18 : 1;
  return base * tempoConfig[tempo].pageMultiplier * rhythmMultiplier;
}

/**
 * Compute postexportduration.
 * @param pages - pages argument
 * @param tempo - tempo argument
 * @param rhythm - rhythm argument
 * @returns Computed value
 */
export function getPostExportDuration(pages: string[], tempo: Tempo, rhythm: Rhythm): number {
  const onePass = pages.reduce(
    (duration, page) => duration + getPageDuration(page, tempo, rhythm),
    0,
  );
  return Math.max(3600, onePass + 650);
}

// Feed rhythm delays — smooth/burst multipliers differ from KineticText getRhythmDelay.
/**
 * Compute worddelay.
 * @param index - index argument
 * @param tempo - tempo argument
 * @param rhythm - rhythm argument
 * @returns Computed value
 */
export function getWordDelay(index: number, tempo: Tempo, rhythm: Rhythm): number {
  const base = tempoConfig[tempo].wordDelay;
  if (rhythm === "poetic") return index * base * 1.45;
  if (rhythm === "smooth") return index * base * 0.58;
  if (rhythm === "burst") return Math.min(index * base * 0.42, 0.38);
  return index * base;
}

/**
 * Compute textsafeinsets.
 * @param canvasHeight - canvasHeight argument
 * @returns Computed value
 */
export function getTextSafeInsets(canvasHeight: number): { top: number; bottom: number } {
  return {
    top: Math.max(TEXT_SAFE_TOP_PX, canvasHeight * 0.09),
    bottom: Math.max(TEXT_SAFE_BOTTOM_PX, canvasHeight * 0.17),
  };
}
