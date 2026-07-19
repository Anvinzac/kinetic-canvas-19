/**
 * Layout-fit state for WordSequenceText (per-page scale, solo stretch, safe Y).
 *
 * Exports: useWordSequenceFit
 * Depends on: playback-timing fit helpers, kinetic-text getMeasuredTextWidth
 */

import {
  useEffect,
  useLayoutEffect,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import { getMeasuredTextWidth } from "@/features/kinetic-text";
import type { CanvasSpec } from "@/lib/canvas";
import {
  MIN_ENGLISH_TEXT_FIT_SCALE,
  MIN_FONT_SIZE,
  MIN_TEXT_FIT_SCALE,
  SOLO_REVEAL_MIN_FIT,
  SOLO_REVEAL_MIN_INLINE_SCALE,
  SOLO_REVEAL_MAX_STRETCH,
  SOLO_REVEAL_TARGET_WIDTH_FRACTION,
  SOLO_TEXT_MIN_FIT,
  clampNumber,
  getMeasuredSoloWordWidth,
  getTextSafeInsets,
} from "../lib/playback-timing";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export type UseWordSequenceFitArgs = {
  initialFit: number;
  canvasWidth: number;
  background?: string | null;
  spec: CanvasSpec;
  disableFit: boolean;
  onFitScale?: (scale: number) => void;
  isSolo: boolean;
  isVietnamese: boolean;
  leftAnchoredText: boolean;
  visualScaleGuard: number;
  wrapperRef: RefObject<HTMLDivElement | null>;
  textRef: RefObject<HTMLDivElement | null>;
};

export type UseWordSequenceFitResult = {
  fitScale: number;
  soloInlineScale: number;
  safeCenterY: number;
  fontSize: number;
  setFitScale: Dispatch<SetStateAction<number>>;
};

/**
 * @responsibility Measure and converge per-page text fit inside the canvas safe area.
 */
export function useWordSequenceFit({
  initialFit,
  canvasWidth,
  background,
  spec,
  disableFit,
  onFitScale,
  isSolo,
  isVietnamese,
  leftAnchoredText,
  visualScaleGuard,
  wrapperRef,
  textRef,
}: UseWordSequenceFitArgs): UseWordSequenceFitResult {
  const [fitScale, setFitScale] = useState(initialFit);
  const [soloInlineScale, setSoloInlineScale] = useState(1);
  const [safeCenterY, setSafeCenterY] = useState(spec.y);
  const fontSize = spec.size * (disableFit ? 1 : fitScale);

  useIsomorphicLayoutEffect(() => {
    setFitScale(initialFit);
    setSoloInlineScale(1);
    setSafeCenterY(spec.y);
  }, [
    initialFit,
    canvasWidth,
    background,
    spec.color,
    spec.font,
    spec.letterSpacing,
    spec.rotation,
    spec.size,
    spec.text,
    spec.weight,
    spec.y,
  ]);

  useIsomorphicLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const text = textRef.current;
    const canvas = wrapper?.parentElement?.parentElement;
    if (!wrapper || !text || !canvas) return;

    const wrapperWidth = wrapper.clientWidth;
    const canvasHeight = canvas.getBoundingClientRect().height;
    if (!wrapperWidth || !canvasHeight) return;

    const safeInsets = getTextSafeInsets(canvasHeight);
    const safeHeight = Math.max(160, canvasHeight - safeInsets.top - safeInsets.bottom);
    const maxHeight = safeHeight * 0.92;
    // A solo page's text container is forced to width:100% (see the textRef
    // style below) so it centers within the wrapper — its scrollWidth is just
    // that 100% width, not the word's actual glyph width. Measure the
    // innermost word span directly instead, undoing the scaleX already
    // applied so we recover the word's true intrinsic width.
    const measuredWidth = isSolo
      ? getMeasuredSoloWordWidth(text, soloInlineScale)
      : getMeasuredTextWidth(text, wrapper, leftAnchoredText);
    const widthRatio = wrapperWidth / Math.max(measuredWidth * visualScaleGuard, 1);
    const heightRatio = maxHeight / Math.max(text.scrollHeight, 1);
    // A single word cannot wrap, so the usual immersive minimums must not block
    // it from shrinking enough to fit. For reveal words, keep the letters tall
    // and condense the word horizontally only when that is needed to stay inside
    // the canvas bounds.
    const finalSizeFloor = Math.min(1, MIN_FONT_SIZE / Math.max(spec.size, 1));
    const floor = isSolo
      ? SOLO_TEXT_MIN_FIT
      : Math.max(isVietnamese ? MIN_TEXT_FIT_SCALE : MIN_ENGLISH_TEXT_FIT_SCALE, finalSizeFloor);
    const widthFit = Math.min(1, fitScale * widthRatio * 0.98);
    const heightFit = Math.min(1, fitScale * heightRatio * 0.98);
    // The hard safety boundary (uncapped) — the actual scale beyond which the
    // word would spill outside the wrapper/safe-height. Unlike widthFit/heightFit
    // above (capped at the page's own configured size), this is allowed to exceed
    // 1 so a short reveal word can grow past its nominal size.
    const widthFitRaw = fitScale * widthRatio * 0.98;
    const heightFitRaw = fitScale * heightRatio * 0.98;
    // A solo reveal word is the punchline — it should be the single biggest,
    // boldest moment on the page, not capped at the body lines' font size. Solve
    // directly for the scale that makes the word fill the target share of the
    // real canvas width (grows past 1x for short words, shrinks for long ones),
    // then let the height ceiling and a soft floor bound it.
    const targetWidthRatio =
      (canvasWidth * SOLO_REVEAL_TARGET_WIDTH_FRACTION) /
      Math.max(measuredWidth * visualScaleGuard, 1);
    const widthFitTarget = fitScale * targetWidthRatio;
    const nextFit = isSolo
      ? Math.max(floor, Math.min(Math.max(widthFitTarget, SOLO_REVEAL_MIN_FIT), heightFitRaw))
      : Math.max(floor, Math.min(1, widthFit, heightFit));
    // Close any remaining gap between the chosen font scale and the target width
    // with a horizontal-only stretch/squish so the letters stay their full height
    // even when the height ceiling capped the font scale below the target, or the
    // soft floor held it above what the long word's true fit would allow.
    const nextSoloInlineScale = isSolo
      ? clampNumber(
          Math.min(widthFitTarget, widthFitRaw) / Math.max(nextFit, 0.01),
          SOLO_REVEAL_MIN_INLINE_SCALE,
          SOLO_REVEAL_MAX_STRETCH,
        )
      : 1;
    const textHeight = text.scrollHeight;
    const requestedCenter = (canvasHeight * spec.y) / 100;
    const halfText = Math.min(textHeight / 2, safeHeight / 2);
    const minCenter = safeInsets.top + halfText;
    const maxCenter = canvasHeight - safeInsets.bottom - halfText;
    const nextCenterY =
      minCenter <= maxCenter
        ? (clampNumber(requestedCenter, minCenter, maxCenter) / canvasHeight) * 100
        : ((safeInsets.top + safeHeight / 2) / canvasHeight) * 100;

    // Solo pages may need to grow fitScale past its initial 1 (to fill the
    // target width), not just shrink — react to either direction. Multi-word
    // pages never compute a nextFit above 1, so this stays shrink-only for them.
    if (!disableFit && Math.abs(nextFit - fitScale) > 0.01) {
      setFitScale(nextFit);
    } else {
      // Converged — report the scale this page needs so the parent can pick a
      // single shared size that keeps every page the same immersive size.
      onFitScale?.(nextFit);
    }
    if (Math.abs(nextSoloInlineScale - soloInlineScale) > 0.01) {
      setSoloInlineScale(nextSoloInlineScale);
    }
    if (Math.abs(nextCenterY - safeCenterY) > 0.2) {
      setSafeCenterY(nextCenterY);
    }
  }, [
    disableFit,
    onFitScale,
    fitScale,
    fontSize,
    canvasWidth,
    spec.font,
    spec.letterSpacing,
    spec.rotation,
    spec.size,
    spec.text,
    spec.weight,
    spec.y,
    isVietnamese,
    leftAnchoredText,
    visualScaleGuard,
    soloInlineScale,
    safeCenterY,
  ]);


  return { fitScale, soloInlineScale, safeCenterY, fontSize, setFitScale };
}
