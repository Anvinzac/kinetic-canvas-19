/**
 * Pure helpers for layout.
 *
 * Exports: KineticTextLayoutMode, getKineticTextLayoutMode, getMeasuredTextWidth, hasVisibleStickerAccent
 * Depends on: @/features/canvas
 */

import type { CanvasSpec } from "@/features/canvas";
import { getStableNumber } from "./stable-hash";

export type KineticTextLayoutMode = "left-spotlight" | "left" | "center";

/**
 * Choose left / center / spotlight layout from text + emphasis.
 * @param text - text argument
 * @param isVietnamese - isVietnamese argument
 * @param wordCount - wordCount argument
 * @param emphasized - emphasized argument
 * @returns Layout mode used by KineticText preview and PostCard WordSequenceText
 */
export function getKineticTextLayoutMode(
  text: string,
  isVietnamese: boolean,
  wordCount: number,
  emphasized: Set<number>,
): KineticTextLayoutMode {
  const hasEmphasis = emphasized.size > 0;
  const seed = getStableNumber(text);
  if (isVietnamese) return hasEmphasis && seed % 4 === 0 ? "left-spotlight" : "left";
  if (wordCount <= 3) return "center";
  if (hasEmphasis && seed % 5 === 0) return "left-spotlight";
  return seed % 2 === 0 || wordCount >= 6 ? "left" : "center";
}

/**
 * Measure rendered text width, using right-edge for left-anchored runs.
 * @param text - text argument
 * @param wrapper - wrapper argument
 * @param leftAnchored - leftAnchored argument
 * @returns Width in CSS pixels
 */
export function getMeasuredTextWidth(
  text: HTMLElement,
  wrapper: HTMLElement,
  leftAnchored: boolean,
): number {
  if (!leftAnchored) return text.scrollWidth;

  const wrapperLeft = wrapper.getBoundingClientRect().left;
  const rightEdge = Array.from(text.querySelectorAll("span")).reduce((maxRight, element) => {
    return Math.max(maxRight, element.getBoundingClientRect().right - wrapperLeft);
  }, 0);

  return rightEdge || text.scrollWidth;
}

/**
 * Measure the widest single word the text node holds, ignoring any transforms.
 *
 * Each rendered word wraps its glyphs in one `[data-kinetic-glyph]` span, so the
 * largest of those is the longest unbreakable token on the page. Words never
 * break mid-glyph, so this — not the wrapped line width — is what has to fit the
 * safe width: if the widest word fits, wrapping keeps every line inside it too.
 * @param text - text node containing the rendered words
 * @returns Widest word layout width in CSS pixels (0 when nothing is measured)
 */
export function getWidestWordWidth(text: HTMLElement): number {
  let widest = 0;
  for (const glyph of text.querySelectorAll("[data-kinetic-glyph]")) {
    const element = glyph as HTMLElement;
    widest = Math.max(widest, element.offsetWidth, element.scrollWidth);
  }
  return widest;
}

/**
 * Detect whether any sticker word appears in the canvas text.
 * @param stickers - stickers argument
 * @param text - text argument
 * @returns true when a sticker word is a substring of the text (case-insensitive)
 */
export function hasVisibleStickerAccent(stickers: CanvasSpec["stickers"], text: string): boolean {
  const normalizedText = text.toLowerCase();
  return (stickers ?? []).some((sticker) => normalizedText.includes(sticker.word.toLowerCase()));
}
