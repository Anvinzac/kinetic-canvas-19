/**
 * Shared multi-page text fit scale for consistent immersive sizing.
 *
 * Exports: useTextFitScale
 * Depends on: playback-timing isSoloTextPage/getUniformPageTextSize/MIN_FONT_SIZE
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MIN_FONT_SIZE,
  getUniformPageTextSize,
  isSoloTextPage,
} from "../lib/playback-timing";

export type UseTextFitScaleArgs = {
  textPages: string[];
  uniformPageSize: number;
  canvasWidth: number;
  currentText: string;
};

export type UseTextFitScaleResult = {
  pageFitScales: Record<number, number>;
  reportPageFit: (page: number, scale: number) => void;
  needsSharedFit: boolean;
  useSharedSize: boolean;
  sharedFitScale: number;
  displaySize: number;
};

/**
 * Measure each multi-word page and apply the smallest fit to all.
 * @param args - UseTextFitScaleArgs fields
 * @returns Hook API for callers
 */
export function useTextFitScale({
  textPages,
  uniformPageSize,
  canvasWidth,
  currentText,
}: UseTextFitScaleArgs): UseTextFitScaleResult {
  const [pageFitScales, setPageFitScales] = useState<Record<number, number>>({});
  const reportPageFit = useCallback((page: number, scale: number): void => {
    setPageFitScales((prev) =>
      prev[page] !== undefined && Math.abs(prev[page] - scale) < 0.005
        ? prev
        : { ...prev, [page]: scale },
    );
  }, []);

  useEffect(() => {
    setPageFitScales({});
  }, [textPages, uniformPageSize, canvasWidth]);

  const sharedFitIndexes = useMemo(
    () => textPages.map((_, i) => i).filter((i) => !isSoloTextPage(textPages[i])),
    [textPages],
  );
  const needsSharedFit = sharedFitIndexes.length > 1;
  const allPagesMeasured =
    needsSharedFit && sharedFitIndexes.every((i) => pageFitScales[i] !== undefined);
  const sharedFitScale = allPagesMeasured
    ? Math.min(...sharedFitIndexes.map((i) => pageFitScales[i])): 1;
  const currentIsSolo = isSoloTextPage(currentText);
  const useSharedSize = allPagesMeasured && !currentIsSolo;
  const displaySize = Math.max(
    MIN_FONT_SIZE,
    useSharedSize ? uniformPageSize * sharedFitScale : uniformPageSize,
  );

  return {
    pageFitScales,
    reportPageFit,
    needsSharedFit,
    useSharedSize,
    sharedFitScale,
    displaySize,
  };
}
