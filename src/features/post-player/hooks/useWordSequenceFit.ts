/**
 * Layout-fit state for WordSequenceText (per-page scale, solo stretch, safe Y).
 *
 * Exports: useWordSequenceFit
 * Depends on: lib/word-sequence-fit computeWordSequenceFit
 */

import {
  useEffect,
  useLayoutEffect,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import type { CanvasSpec } from "@/lib/canvas";
import { computeWordSequenceFit } from "../lib/word-sequence-fit";

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
 * Measure and converge per-page text fit inside the canvas safe area.
 * @param args - Canvas geometry, typography, and fit-scale setters
 * @returns Fit scale, solo inline scale, and safe vertical center
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

    const next = computeWordSequenceFit({
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
      specSize: spec.size,
      specY: spec.y,
    });
    if (!next) return;

    // Solo pages may need to grow fitScale past its initial 1 (to fill the
    // target width), not just shrink — react to either direction. Multi-word
    // pages never compute a nextFit above 1, so this stays shrink-only for them.
    if (!disableFit && Math.abs(next.nextFit - fitScale) > 0.01) {
      setFitScale(next.nextFit);
    } else {
      // Converged — report the scale this page needs so the parent can pick a
      // single shared size that keeps every page the same immersive size.
      onFitScale?.(next.nextFit);
    }
    if (Math.abs(next.nextSoloInlineScale - soloInlineScale) > 0.01) {
      setSoloInlineScale(next.nextSoloInlineScale);
    }
    if (Math.abs(next.nextCenterY - safeCenterY) > 0.2) {
      setSafeCenterY(next.nextCenterY);
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
