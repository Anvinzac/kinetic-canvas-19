import type { CanvasSpec } from "@/features/canvas";
import { getStableNumber } from "./stable-hash";

export type KineticTextLayoutMode = "left-spotlight" | "left" | "center";

/**
 * @responsibility Choose left / center / spotlight layout from text + emphasis.
 * @inputs Full text, Vietnamese flag, word count, emphasized indexes
 * @outputs Layout mode used by KineticText preview and PostCard WordSequenceText
 * @pure true
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
 * @responsibility Measure rendered text width, using right-edge for left-anchored runs.
 * @inputs Text element, wrapper element, whether text is left-anchored
 * @outputs Width in CSS pixels
 * @pure false
 */
export function getMeasuredTextWidth(
  text: HTMLElement,
  wrapper: HTMLElement,
  leftAnchored: boolean,
) {
  if (!leftAnchored) return text.scrollWidth;

  const wrapperLeft = wrapper.getBoundingClientRect().left;
  const rightEdge = Array.from(text.querySelectorAll("span")).reduce((maxRight, element) => {
    return Math.max(maxRight, element.getBoundingClientRect().right - wrapperLeft);
  }, 0);

  return rightEdge || text.scrollWidth;
}

/**
 * @responsibility Detect whether any sticker word appears in the canvas text.
 * @inputs Sticker list + canvas text
 * @outputs true when a sticker word is a substring of the text (case-insensitive)
 * @pure true
 */
export function hasVisibleStickerAccent(stickers: CanvasSpec["stickers"], text: string) {
  const normalizedText = text.toLowerCase();
  return (stickers ?? []).some((sticker) => normalizedText.includes(sticker.word.toLowerCase()));
}
