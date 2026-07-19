/**
 * Pure layout-fit math for WordSequenceText (scale, solo stretch, safe Y).
 *
 * Exports: computeWordSequenceFit
 * Depends on: kinetic-text getMeasuredTextWidth, playback-timing + solo-text-fit helpers
 */

import { getMeasuredTextWidth } from "@/features/kinetic-text";
import {
  MIN_ENGLISH_TEXT_FIT_SCALE,
  MIN_FONT_SIZE,
  MIN_TEXT_FIT_SCALE,
  getTextSafeInsets,
} from "./playback-timing";
import {
  SOLO_REVEAL_MIN_FIT,
  SOLO_REVEAL_MIN_INLINE_SCALE,
  SOLO_REVEAL_MAX_STRETCH,
  SOLO_REVEAL_TARGET_WIDTH_FRACTION,
  SOLO_TEXT_MIN_FIT,
  clampNumber,
  getMeasuredSoloWordWidth,
} from "./solo-text-fit";

export type WordSequenceFitInput = {
  wrapper: HTMLDivElement;
  text: HTMLDivElement;
  canvas: HTMLElement;
  canvasWidth: number;
  fitScale: number;
  soloInlineScale: number;
  isSolo: boolean;
  isVietnamese: boolean;
  leftAnchoredText: boolean;
  visualScaleGuard: number;
  specSize: number;
  specY: number;
};

export type WordSequenceFitOutput = {
  nextFit: number;
  nextSoloInlineScale: number;
  nextCenterY: number;
};

/**
 * Measure the text node and compute the next fit / stretch / Y.
 * @param input - input argument
 * @returns Function result
 */
export function computeWordSequenceFit(input: WordSequenceFitInput): WordSequenceFitOutput | null {
  const {
    wrapper,
    text,
    canvas,
    canvasWidth,
    fitScale,
    soloInlineScale,
    isSolo,
    isVietnamese,
    leftAnchoredText,
    visualScaleGuard,
    specSize,
    specY,
  } = input;

  const wrapperWidth = wrapper.clientWidth;
  const canvasHeight = canvas.getBoundingClientRect().height;
  if (!wrapperWidth || !canvasHeight) return null;

  const safeInsets = getTextSafeInsets(canvasHeight);
  const safeHeight = Math.max(160, canvasHeight - safeInsets.top - safeInsets.bottom);
  const maxHeight = safeHeight * 0.92;
  // A solo page's text container is forced to width:100% so it centers within the
  // wrapper — its scrollWidth is just that 100% width, not the word's actual glyph
  // width. Measure the innermost word span directly instead, undoing scaleX.
  const measuredWidth = isSolo
    ? getMeasuredSoloWordWidth(text, soloInlineScale): getMeasuredTextWidth(text, wrapper, leftAnchoredText);
  const widthRatio = wrapperWidth / Math.max(measuredWidth * visualScaleGuard, 1);
  const heightRatio = maxHeight / Math.max(text.scrollHeight, 1);
  // A single word cannot wrap, so the usual immersive minimums must not block
  // it from shrinking enough to fit. For reveal words, keep letters tall and
  // condense horizontally only when needed to stay inside the canvas bounds.
  const finalSizeFloor = Math.min(1, MIN_FONT_SIZE / Math.max(specSize, 1));
  const floor = isSolo
    ? SOLO_TEXT_MIN_FIT
    : Math.max(isVietnamese ? MIN_TEXT_FIT_SCALE : MIN_ENGLISH_TEXT_FIT_SCALE, finalSizeFloor);
  const widthFit = Math.min(1, fitScale * widthRatio * 0.98);
  const heightFit = Math.min(1, fitScale * heightRatio * 0.98);
  const widthFitRaw = fitScale * widthRatio * 0.98;
  const heightFitRaw = fitScale * heightRatio * 0.98;
  const targetWidthRatio =
    (canvasWidth * SOLO_REVEAL_TARGET_WIDTH_FRACTION) /
    Math.max(measuredWidth * visualScaleGuard, 1);
  const widthFitTarget = fitScale * targetWidthRatio;
  const nextFit = isSolo
    ? Math.max(floor, Math.min(Math.max(widthFitTarget, SOLO_REVEAL_MIN_FIT), heightFitRaw)): Math.max(floor, Math.min(1, widthFit, heightFit));
  const nextSoloInlineScale = isSolo
    ? clampNumber(
        Math.min(widthFitTarget, widthFitRaw) / Math.max(nextFit, 0.01),
        SOLO_REVEAL_MIN_INLINE_SCALE,
        SOLO_REVEAL_MAX_STRETCH,
      ): 1;
  const textHeight = text.scrollHeight;
  const requestedCenter = (canvasHeight * specY) / 100;
  const halfText = Math.min(textHeight / 2, safeHeight / 2);
  const minCenter = safeInsets.top + halfText;
  const maxCenter = canvasHeight - safeInsets.bottom - halfText;
  const nextCenterY =
    minCenter <= maxCenter
      ? (clampNumber(requestedCenter, minCenter, maxCenter) / canvasHeight) * 100
      : ((safeInsets.top + safeHeight / 2) / canvasHeight) * 100;

  return { nextFit, nextSoloInlineScale, nextCenterY };
}
