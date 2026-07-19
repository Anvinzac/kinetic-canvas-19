/**
 * Solo reveal word width estimation and fit helpers for the feed player.
 *
 * Exports: SOLO_* constants, clampNumber, estimateWordWidth, estimateSoloRevealFit, getMeasuredSoloWordWidth
 * Depends on: none (leaf module)
 */

/** Single-word pages may shrink this far to keep a long word on screen. */
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

// Average glyph advance as a fraction of the font size for the heavy sans we
// render reveal words in. Deliberately on the wide side so the predicted width
// is never an under-estimate — the word starts a touch small and the precise
// layout effect grows it to the exact target, rather than ever flashing wider
// than the canvas before the effect runs.
const AVG_GLYPH_WIDTH_EM = 0.62;

let soloMeasureCtx: CanvasRenderingContext2D | null | undefined;

/**
 * Clamp a number into an inclusive [min, max] range.
 * @param value - Raw value
 * @param min - Lower bound
 * @param max - Upper bound
 * @returns Clamped value
 */
export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Estimate rendered width of a word at a given font size/weight.
 * @param word - Word text
 * @param size - Font size in px
 * @param font - Font family
 * @param weight - Font weight
 * @returns Estimated width in CSS pixels
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
 * Estimate solo-reveal fit scale so the punchline word hits the target width fraction.
 * @param text - Solo word text
 * @param size - Font size in px
 * @param canvasWidth - Canvas width in px
 * @param visualScaleGuard - Extra visual scale guard (emphasis/entrance)
 * @param font - Font family
 * @param weight - Font weight
 * @param emphasisFactor - Emphasis font-size multiplier
 * @returns Fit scale clamped to solo reveal bounds
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
 * Measure the innermost glyph span width, undoing the current solo inline scale.
 * @param text - Text container element
 * @param soloInlineScale - Current horizontal solo scale applied in layout
 * @returns Unscaled measured word width
 */
export function getMeasuredSoloWordWidth(text: HTMLElement, soloInlineScale: number): number {
  const spans = Array.from(text.querySelectorAll("span"));
  const glyphSpan = spans.find((span) => span.querySelector("span") === null);
  const raw = glyphSpan ? glyphSpan.getBoundingClientRect().width : text.scrollWidth;
  return raw / Math.max(soloInlineScale, 0.01);
}
