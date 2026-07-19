/**
 * Feed-player tempo, page duration, and text sizing helpers (not KineticText preview tempo).
 *
 * Exports: tempoConfig, TEXT_SAFE_*, fit constants, getPageDuration, getWordDelay, getUniformPageTextSize, isSoloTextPage, solo fit helpers
 * Depends on: features/canvas Tempo/Rhythm, features/kinetic-text getWords/isLikelyVietnameseText
 */

import type { Rhythm, Tempo } from "@/lib/canvas";
import { getWords, isLikelyVietnameseText } from "@/features/kinetic-text";

/** Keep kinetic text clear of the canvas edge without stealing its scale. */
export const TEXT_SAFE_MAX_WIDTH = "min(92%, calc(100% - 2rem))";
export const TEXT_SAFE_TOP_PX = 72;
export const TEXT_SAFE_BOTTOM_PX = 132;
export const MIN_TEXT_FIT_SCALE = 0.46;
export const MIN_ENGLISH_TEXT_FIT_SCALE = 0.72;
// A single-word page (e.g. a one-word reveal) cannot wrap, so it is allowed to
// shrink this far to fit a long word fully on screen.
export const SOLO_TEXT_MIN_FIT = 0.3;
export const SOLO_REVEAL_MIN_FIT = 0.62;
// The reveal word is the punchline of a guessing post — it should dominate the
// canvas. Solved-for directly as a share of the real canvas width, so a short
// word ("Dawn") grows well past its nominal size and a long one ("Persistence")
// shrinks just enough to land on the same target, never leaving empty margins.
// Held a touch under the safe edge (a hard 85%) so the word keeps its hero size
// while still leaving margin for the emphasis pulse/entrance overshoot — i.e. it
// never spills off either side even mid-animation.
export const SOLO_REVEAL_TARGET_WIDTH_FRACTION = 0.85;
// Horizontal-only correction (transform: scaleX) closing any gap between the
// chosen font scale and the target width, without touching letter height.
export const SOLO_REVEAL_MIN_INLINE_SCALE = 0.45;
export const SOLO_REVEAL_MAX_STRETCH = 1.7;
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

/**
 * clampNumber helper
 * @param value - value argument
 * @param min - min argument
 * @param max - max argument
 * @returns Computed value
 */
export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Average glyph advance as a fraction of the font size for the heavy sans we
// render reveal words in. Deliberately on the wide side so the predicted width
// is never an under-estimate — the word starts a touch small and the precise
// layout effect grows it to the exact target, rather than ever flashing wider
// than the canvas before the effect runs.
const AVG_GLYPH_WIDTH_EM = 0.62;

let soloMeasureCtx: CanvasRenderingContext2D | null | undefined;

/**
 * estimateWordWidth helper
 * @param word - word argument
 * @param size - size argument
 * @param font - font argument
 * @param weight - weight argument
 * @returns Function result
 */
export function estimateWordWidth(word: string, size: number, font: string, weight: number): number {
  const trimmed = word.trim();
  if (!trimmed) return 0;
  if (typeof document !== "undefined") {
    if (soloMeasureCtx === undefined) {
      soloMeasureCtx = document.createElement("canvas").getContext("2d");
    }
    if (soloMeasureCtx) {
      soloMeasureCtx.font = `${weight} ${size}px ${font}, system-ui, sans-serif`;
      const measured = soloMeasureCtx.measureText(trimmed).width;
      if (measured > 0) return measured;
    }
  }
  return trimmed.length * size * AVG_GLYPH_WIDTH_EM;
}

/**
 * estimateSoloRevealFit helper
 * @param text - text argument
 * @param size - size argument
 * @param canvasWidth - canvasWidth argument
 * @param visualScaleGuard - visualScaleGuard argument
 * @param font - font argument
 * @param weight - weight argument
 * @param emphasisFactor - emphasisFactor argument
 * @returns Function result
 */
export function estimateSoloRevealFit(
  text: string,
  size: number,
  canvasWidth: number,
  visualScaleGuard: number,
  font: string,
  weight: number,
  emphasisFactor: number,
): number {
  const estWidth =
    estimateWordWidth(text, size, font, weight) * Math.max(visualScaleGuard, 1) * emphasisFactor;
  if (estWidth <= 0 || canvasWidth <= 0) return 1;
  const target = (canvasWidth * SOLO_REVEAL_TARGET_WIDTH_FRACTION) / estWidth;
  return clampNumber(target, SOLO_REVEAL_MIN_FIT, SOLO_REVEAL_MAX_STRETCH);
}

/**
 * Compute measuredsolowordwidth.
 * @param text - text argument
 * @param soloInlineScale - soloInlineScale argument
 * @returns Computed value
 */
export function getMeasuredSoloWordWidth(text: HTMLElement, soloInlineScale: number): number {
  const spans = Array.from(text.querySelectorAll("span"));
  const glyphSpan = spans.find((span) => span.querySelector("span") === null);
  const raw = glyphSpan ? glyphSpan.getBoundingClientRect().width : text.scrollWidth;
  return raw / Math.max(soloInlineScale, 0.01);
}

