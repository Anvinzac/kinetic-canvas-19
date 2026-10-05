/**
 * Pure layout-fit math for WordSequenceText (scale, solo stretch, safe Y).
 *
 * Exports: computeWordSequenceFit, clampFitToWidestWord
 * Depends on: kinetic-text getMeasuredTextWidth, playback-timing + solo-text-fit helpers
 */

import { getMeasuredTextWidth, getWidestWordWidth } from "@/features/kinetic-text";
import {
  MIN_ENGLISH_TEXT_FIT_SCALE,
  MIN_FONT_SIZE,
  MIN_TEXT_FIT_SCALE,
  TEXT_SAFE_MIN_EDGE_GAP_PX,
  getTextSafeInsets,
} from "./playback-timing";
import {
  SOLO_REVEAL_TARGET_WIDTH_FRACTION,
  clampNumber,
  getMeasuredSoloWordWidth,
  getSoloRevealFit,
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
 * Let horizontal containment override the legibility floor on a wrapping page.
 *
 * `floorFit` keeps multi-word pages readable, but it can re-inflate a page whose
 * longest unbreakable word no longer fits the safe width — which is how a word of
 * more than a few letters spills past both screen edges. Because words wrap whole,
 * the page only truly overflows when its WIDEST single word is too wide; that one
 * case is the only time this shrinks below the floor, and it shrinks exactly enough
 * for that word to land inside `availableWidth`. Everything that already fits is
 * returned untouched, so normal pages keep their floor-governed size.
 * @param input floorFit/current fitScale, the widest word's measured width, the safe
 * width to fit it in, and an absolute lower bound so text never collapses to nothing
 * @returns Fit scale that keeps the widest word on screen without over-shrinking
 */
export function clampFitToWidestWord(input: {
  floorFit: number;
  fitScale: number;
  widestWordWidth: number;
  availableWidth: number;
  absoluteMin?: number;
}): number {
  const { floorFit, fitScale, widestWordWidth, availableWidth, absoluteMin = 0.05 } = input;
  if (!(widestWordWidth > 0) || !(availableWidth > 0) || !(fitScale > 0)) return floorFit;
  // Width the widest word occupies if the page is drawn at floorFit.
  const widthAtFloor = widestWordWidth * (floorFit / fitScale);
  if (widthAtFloor <= availableWidth) return floorFit;
  return Math.max(absoluteMin, (floorFit * availableWidth) / widthAtFloor);
}

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
  // width. Measure the innermost word's untransformed layout dimensions instead.
  const measuredWidth = isSolo
    ? getMeasuredSoloWordWidth(text)
    : getMeasuredTextWidth(text, wrapper, leftAnchoredText);
  const widthRatio = wrapperWidth / Math.max(measuredWidth * visualScaleGuard, 1);
  const heightRatio = maxHeight / Math.max(text.scrollHeight, 1);
  // Reveal words use proportional font sizing with no minimum scale or horizontal distortion.
  const finalSizeFloor = Math.min(1, MIN_FONT_SIZE / Math.max(specSize, 1));
  const floor = Math.max(
    isVietnamese ? MIN_TEXT_FIT_SCALE : MIN_ENGLISH_TEXT_FIT_SCALE,
    finalSizeFloor,
  );
  const widthFit = Math.min(1, fitScale * widthRatio * 0.98);
  const heightFit = Math.min(1, fitScale * heightRatio * 0.98);
  let soloAvailableWidth = Math.min(
    wrapperWidth * 0.98,
    canvasWidth * SOLO_REVEAL_TARGET_WIDTH_FRACTION,
  );
  if (isSolo) {
    const rect = wrapper.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const viewport = wrapper.ownerDocument.defaultView?.visualViewport;
    const viewportLeft = viewport?.offsetLeft ?? 0;
    const viewportRight =
      viewportLeft + (viewport?.width ?? wrapper.ownerDocument.documentElement.clientWidth);
    const center = (rect.left + rect.right) / 2;
    const left = Math.max(canvasRect.left, viewportLeft) + TEXT_SAFE_MIN_EDGE_GAP_PX;
    const right = Math.min(canvasRect.right, viewportRight) - TEXT_SAFE_MIN_EDGE_GAP_PX;
    const centeredRoom = Math.max(1, 2 * Math.min(center - left, right - center));
    soloAvailableWidth = Math.min(
      soloAvailableWidth,
      (centeredRoom * wrapperWidth) / Math.max(rect.width, 1),
    );
  }
  const nextFit = isSolo
    ? getSoloRevealFit(
        fitScale,
        measuredWidth,
        text.scrollHeight,
        soloAvailableWidth,
        maxHeight,
        visualScaleGuard,
      )
    : clampFitToWidestWord({
        floorFit: Math.max(floor, Math.min(1, widthFit, heightFit)),
        fitScale,
        widestWordWidth: getWidestWordWidth(text),
        // Reserve the minimum leading/trailing gap on top of the safe-width wrapper.
        availableWidth: Math.max(1, wrapperWidth - TEXT_SAFE_MIN_EDGE_GAP_PX * 2),
      });
  const nextSoloInlineScale = 1;
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
