/**
 * Canvas scale, Vietnamese/Han layout metrics, and text-fit for KineticText preview.
 *
 * Exports: useKineticTextFit
 * Depends on: kinetic layout/text-language, preview-fit helpers
 */

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { getMeasuredTextWidth } from "../lib/layout";
import {
  getHanLayoutMetrics,
  getVietnameseLayoutMetrics,
  type WordLine,
} from "../lib/text-language";
import {
  FULL_CANVAS_MAX_HEIGHT,
  FULL_CANVAS_REFERENCE_WIDTH,
  clamp,
  clampFitScale,
  getPreviewFitFloor,
  useIsomorphicLayoutEffect,
} from "./preview-fit";

/**
 * Provide useKineticTextFit state and actions.
 * @param props - Component props
 * @returns Hook API for callers
 */
export function useKineticTextFit({
  scaleToCanvas,
  isVietnamese,
  isHan,
  words,
  visualScaleGuard,
  leftAnchoredText,
  spec,
  phraseKeys,
}: {
  scaleToCanvas: boolean;
  isVietnamese: boolean;
  /** Han pages pack through the same staggered lines with per-character capacity. */
  isHan: boolean;
  words: string[];
  visualScaleGuard: number;
  leftAnchoredText: boolean;
  /** Bound phrase keys — the curated list plus every highlighted run — kept on one line. */
  phraseKeys?: readonly (readonly string[])[];
  spec: {
    text: string;
    size: number;
    font: string;
    weight: number;
    letterSpacing: number;
    entrance: string;
    x: number;
    y: number;
  };
}): {
  wrapperRef: RefObject<HTMLDivElement | null>;
  textRef: RefObject<HTMLDivElement | null>;
  canvasScale: number;
  fitScale: number;
  previewSize: number;
  packedLines: WordLine[];
} {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [canvasScale, setCanvasScale] = useState(scaleToCanvas ? 0.4 : 1);
  const [canvasWidth, setCanvasWidth] = useState(FULL_CANVAS_REFERENCE_WIDTH);
  // Vietnamese syllables and Han characters pack through the same line machinery; only
  // the per-line capacity curve (glyph widths differ) chooses a different metrics call.
  const isPackedLines = isVietnamese || isHan;
  const packedLayout = useMemo(
    () =>
      isPackedLines
        ? isHan
          ? getHanLayoutMetrics(
              words,
              canvasWidth,
              spec.size * canvasScale,
              visualScaleGuard,
              phraseKeys,
            )
          : getVietnameseLayoutMetrics(
              words,
              canvasWidth,
              spec.size * canvasScale,
              visualScaleGuard,
              phraseKeys,
            )
        : { lines: [], suggestedFitScale: 1 },
    [
      isPackedLines,
      isHan,
      words,
      canvasWidth,
      spec.size,
      canvasScale,
      visualScaleGuard,
      phraseKeys,
    ],
  );
  const [fitScale, setFitScale] = useState(isPackedLines ? packedLayout.suggestedFitScale : 1);
  const previewSize = Math.max(10, spec.size * canvasScale * fitScale);

  useEffect(() => {
    if (!scaleToCanvas) {
      setCanvasScale(1);
      return;
    }

    const wrapper = wrapperRef.current;
    const canvas = wrapper?.parentElement;
    if (!canvas) return;

    function measure() {
      const rect = canvas?.getBoundingClientRect();
      if (!rect?.width || !rect?.height) return;
      setCanvasWidth(rect.width);
      const heightScale = rect.height / FULL_CANVAS_MAX_HEIGHT;
      const widthScale = rect.width / FULL_CANVAS_REFERENCE_WIDTH;
      setCanvasScale(clamp(Math.min(heightScale, widthScale), 0.2, 1));
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [scaleToCanvas]);

  useIsomorphicLayoutEffect(() => {
    setFitScale(isPackedLines ? packedLayout.suggestedFitScale : 1);
  }, [
    canvasScale,
    canvasWidth,
    isPackedLines,
    packedLayout.suggestedFitScale,
    spec.text,
    spec.size,
    spec.font,
    spec.weight,
    spec.letterSpacing,
    spec.entrance,
    spec.x,
    spec.y,
  ]);

  useIsomorphicLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const text = textRef.current;
    const canvas = wrapper?.parentElement;
    if (!wrapper || !text || !canvas) return;

    const canvasHeight = canvas.getBoundingClientRect().height;
    const wrapperWidth = wrapper.getBoundingClientRect().width;
    if (!canvasHeight || !wrapperWidth) return;

    const verticalRoom = (canvasHeight * Math.min(spec.y, 100 - spec.y) * 2) / 100;
    const maxHeight = Math.max(canvasHeight * 0.3, verticalRoom * 0.9);
    const measuredWidth = getMeasuredTextWidth(text, wrapper, leftAnchoredText);
    const widthRatio = wrapperWidth / Math.max(measuredWidth * visualScaleGuard, 1);
    const heightRatio = maxHeight / Math.max(text.scrollHeight, 1);
    const nextFit = Math.min(1, fitScale * Math.min(widthRatio, heightRatio) * 0.98);
    const fitFloor = getPreviewFitFloor(spec.text);

    // What WIDTH alone will allow. The floor below keeps a short page from being shrunk
    // into nothing, but it is a preference about legibility, and fitting inside the box is
    // not — a word held above the width it has is simply drawn outside it, which is worse
    // than the same word set smaller. A one-word page floors at 0.74, so the answer word
    // overflowed as soon as the band was narrowed to clear a platform's side crop.
    //
    // Only bites when the floor is above what the width permits: everywhere else
    // Math.max(fitFloor, nextFit) already sits at or below this, so nothing moves.
    const widthLimit = Math.min(1, fitScale * widthRatio * 0.98);

    if (nextFit < fitScale - 0.01) {
      setFitScale(clampFitScale(nextFit, fitFloor, widthLimit));
    }
  }, [
    fitScale,
    previewSize,
    spec.text,
    spec.font,
    spec.weight,
    spec.letterSpacing,
    spec.entrance,
    spec.y,
    isPackedLines,
    leftAnchoredText,
    visualScaleGuard,
  ]);

  return {
    wrapperRef,
    textRef,
    canvasScale,
    fitScale,
    previewSize,
    packedLines: isPackedLines ? packedLayout.lines : [],
  };
}
