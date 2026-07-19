/**
 * Canvas scale, Vietnamese layout metrics, and text-fit for KineticText preview.
 *
 * Exports: useKineticTextFit
 * Depends on: kinetic layout/text-language, preview-fit helpers
 */

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { getMeasuredTextWidth } from "../lib/layout";
import {
  getVietnameseLayoutMetrics,
  type WordLine,
} from "../lib/text-language";
import {
  FULL_CANVAS_MAX_HEIGHT,
  FULL_CANVAS_REFERENCE_WIDTH,
  clamp,
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
  words,
  visualScaleGuard,
  leftAnchoredText,
  spec,
}: {
  scaleToCanvas: boolean;
  isVietnamese: boolean;
  words: string[];
  visualScaleGuard: number;
  leftAnchoredText: boolean;
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
  vietnameseLines: WordLine[];
} {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [canvasScale, setCanvasScale] = useState(scaleToCanvas ? 0.4 : 1);
  const [canvasWidth, setCanvasWidth] = useState(FULL_CANVAS_REFERENCE_WIDTH);
  const vietnameseLayout = useMemo(
    () =>
      isVietnamese
        ? getVietnameseLayoutMetrics(
            words,
            canvasWidth,
            spec.size * canvasScale,
            visualScaleGuard,
          ): { lines: [], suggestedFitScale: 1 },
    [isVietnamese, words, canvasWidth, spec.size, canvasScale, visualScaleGuard],
  );
  const [fitScale, setFitScale] = useState(
    isVietnamese ? vietnameseLayout.suggestedFitScale : 1,
  );
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
    setFitScale(isVietnamese ? vietnameseLayout.suggestedFitScale : 1);
  }, [
    canvasScale,
    canvasWidth,
    isVietnamese,
    vietnameseLayout.suggestedFitScale,
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

    if (nextFit < fitScale - 0.01) {
      setFitScale(Math.max(fitFloor, nextFit));
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
    isVietnamese,
    leftAnchoredText,
    visualScaleGuard,
  ]);

  return {
    wrapperRef,
    textRef,
    canvasScale,
    fitScale,
    previewSize,
    vietnameseLines: isVietnamese ? vietnameseLayout.lines : [],
  };
}
