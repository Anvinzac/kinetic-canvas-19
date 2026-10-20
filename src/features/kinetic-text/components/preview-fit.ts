/**
 * Canvas scale/fit helpers for KineticText preview layout.
 *
 * Exports: fit constants, getPreviewFitFloor, clamp, useIsomorphicLayoutEffect
 * Depends on: react, kinetic-text words
 */

import { useEffect, useLayoutEffect } from "react";
import { getHanTokens, isLikelyChineseText } from "../lib/text-language";
import { getWords } from "../lib/words";

export const FULL_CANVAS_MAX_HEIGHT = 764;
export const FULL_CANVAS_REFERENCE_WIDTH = FULL_CANVAS_MAX_HEIGHT * (9 / 16);
// Same canvas-safe inset as PostCard: clear the edge without shrinking the status energy.
export const TEXT_SAFE_MAX_WIDTH = "min(92%, calc(100% - 2rem))";
export const MIN_TEXT_FIT_SCALE = 0.46;
export const VIETNAMESE_SCALE_FIT_GUARD = 1.24;
export const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Compute previewfitfloor. Han pages count per-character tokens, not whitespace words —
 * a whole Chinese sentence is one whitespace token, and a 1-word floor would pin its
 * packed lines far too large to fit the canvas.
 * @param text - text argument
 * @returns Computed value
 */
export function getPreviewFitFloor(text: string): number {
  const words = isLikelyChineseText(text) ? getHanTokens(text).length : getWords(text).length;
  if (words <= 8) return 0.74;
  if (words <= 14) return 0.62;
  if (words <= 22) return 0.52;
  return MIN_TEXT_FIT_SCALE;
}

/**
 * The fit scale a page is actually set at.
 *
 * Two constraints that are NOT the same kind of thing. `fitFloor` is a preference: it keeps
 * a short page from being shrunk into illegibility. `widthLimit` is physical: past it the
 * text is drawn outside the box it was given. When they disagree the box wins, because a
 * word held above the width it has does not become more readable by being bigger — it
 * becomes a word with its ends cut off.
 *
 * The one-word floor is 0.74, so this is what keeps a long answer word inside a band that
 * has been narrowed to clear a platform's side crop.
 *
 * @param nextFit - the scale width and height together ask for
 * @param fitFloor - the smallest scale legibility would like to allow
 * @param widthLimit - the largest scale that still fits the width
 * @returns the scale to set, never above `widthLimit`
 * @pure true
 */
export function clampFitScale(nextFit: number, fitFloor: number, widthLimit: number): number {
  return Math.min(Math.max(fitFloor, nextFit), widthLimit);
}

/**
 * clamp helper
 * @param value - value argument
 * @param min - min argument
 * @param max - max argument
 * @returns Computed value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
