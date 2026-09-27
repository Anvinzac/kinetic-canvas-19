/**
 * Text-language public API — page limits, Vietnamese detection, layout, bound phrases.
 *
 * Exports: getTextPageWordLimit, isLikelyVietnameseText, layout + phrase helpers
 * Depends on: text-language/page-metrics, text-language/vietnamese-phrases
 */

import { isLikelyVietnameseText } from "./vietnamese-phrases";

/** Default max words per English kinetic page — a soft preference for page rhythm, not a split boundary. */
export const DEFAULT_TEXT_PAGE_WORD_LIMIT = 7;
/** Default max words per Vietnamese kinetic page — a soft preference for page rhythm, not a split boundary. */
export const VIETNAMESE_TEXT_PAGE_WORD_LIMIT = 10;

export type {
  WordLine,
  WordSegment,
  VietnameseLineLayoutOptions,
  VietnameseLayoutMetrics,
} from "./types";

export {
  getVietnameseCanvasInnerWidth,
  getVietnameseCharBudgetForLine,
  getVietnameseLayoutMetrics,
  getVietnameseWordLines,
} from "./page-metrics";

export {
  expandEmphasisToBoundPhrases,
  getBoundPhraseEmphasisSeed,
  getBoundPhraseStartIndex,
  getSpecialPoeticWordIndexes,
  isLikelyVietnameseText,
  repairSplitCompoundEmphasis,
} from "./vietnamese-phrases";
export { getDataEmphasisWordIndexes } from "./data-emphasis";

/**
 * Choose the page word budget based on detected language.
 * Sentence-safe pagination keeps sentences whole, so the limit acts as a soft
 * preference for page rhythm — it also anchors the long-sentence threshold
 * (2× the limit) below which a sentence never breaks.
 * @param text - text argument
 * @returns VIETNAMESE_TEXT_PAGE_WORD_LIMIT or DEFAULT_TEXT_PAGE_WORD_LIMIT
 */
export function getTextPageWordLimit(text: string): number {
  return isLikelyVietnameseText(text)
    ? VIETNAMESE_TEXT_PAGE_WORD_LIMIT
    : DEFAULT_TEXT_PAGE_WORD_LIMIT;
}
