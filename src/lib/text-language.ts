/**
 * Compatibility shim — prefer `@/features/kinetic-text`.
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
} from "@/features/kinetic-text";
export type {
  VietnameseLayoutMetrics,
  VietnameseLineLayoutOptions,
  WordLine,
  WordSegment,
} from "@/features/kinetic-text";
