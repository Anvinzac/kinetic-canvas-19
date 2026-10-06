/**
 * Compatibility shim — prefer `@/features/kinetic-text` text-language exports.
 *
 * Exports: re-exports text-language/index public API
 * Depends on: features/kinetic-text/lib/text-language
 */

export {
  DEFAULT_TEXT_PAGE_WORD_LIMIT,
  VIETNAMESE_TEXT_PAGE_WORD_LIMIT,
  expandEmphasisToBoundPhrases,
  getBoundPhraseEmphasisSeed,
  getBoundPhraseStartIndex,
  getDataEmphasisWordIndexes,
  getDataEmphasisWordSpans,
  getEmphasisPhraseKeysForLayout,
  getSpecialPoeticWordIndexes,
  getTextPageWordLimit,
  getVietnameseCanvasInnerWidth,
  getVietnameseCharBudgetForLine,
  getVietnameseLayoutMetrics,
  getVietnameseWordLines,
  isLikelyVietnameseText,
  repairSplitCompoundEmphasis,
  SHORT_SENTENCE_MAX_WORDS,
  countSentenceWords,
  limitShortSentenceEmphasis,
} from "./text-language/index";
export type {
  VietnameseLayoutMetrics,
  VietnameseLineLayoutOptions,
  WordLine,
  WordSegment,
} from "./text-language/index";
