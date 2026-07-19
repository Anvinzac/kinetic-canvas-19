/**
 * Canvas scale/fit helpers for KineticText preview layout.
 *
 * Exports: fit constants, getPreviewFitFloor, clamp, useIsomorphicLayoutEffect
 * Depends on: react, kinetic-text words
 */

import { useEffect, useLayoutEffect } from "react";
import { getWords } from "../lib/words";

export const FULL_CANVAS_MAX_HEIGHT = 764;
export const FULL_CANVAS_REFERENCE_WIDTH = FULL_CANVAS_MAX_HEIGHT * (9 / 16);
// Same canvas-safe inset as PostCard: clear the edge without shrinking the status energy.
export const TEXT_SAFE_MAX_WIDTH = "min(92%, calc(100% - 2rem))";
export const MIN_TEXT_FIT_SCALE = 0.46;
export const VIETNAMESE_SCALE_FIT_GUARD = 1.24;
export const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function getPreviewFitFloor(text: string) {
  const words = getWords(text).length;
  if (words <= 8) return 0.74;
  if (words <= 14) return 0.62;
  if (words <= 22) return 0.52;
  return MIN_TEXT_FIT_SCALE;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
