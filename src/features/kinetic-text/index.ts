export { KineticText } from "./components/KineticText";

export {
  DEFAULT_TEXT_PAGE_WORD_LIMIT,
  VIETNAMESE_TEXT_PAGE_WORD_LIMIT,
  expandEmphasisToBoundPhrases,
  getBoundPhraseEmphasisSeed,
  getBoundPhraseStartIndex,
  getSpecialPoeticWordIndexes,
  getTextPageWordLimit,
  getVietnameseCanvasInnerWidth,
  getVietnameseCharBudgetForLine,
  getVietnameseLayoutMetrics,
  getVietnameseWordLines,
  isLikelyVietnameseText,
} from "./lib/text-language";
export type {
  VietnameseLayoutMetrics,
  VietnameseLineLayoutOptions,
  WordLine,
  WordSegment,
} from "./lib/text-language";

export { getStableNumber } from "./lib/stable-hash";
export { getWordAnchorKey, getWords } from "./lib/words";
export {
  getKineticTextLayoutMode,
  getMeasuredTextWidth,
  hasVisibleStickerAccent,
} from "./lib/layout";
export type { KineticTextLayoutMode } from "./lib/layout";
export { getLoopAnimation, TEMPO_LOOP_SECONDS } from "./lib/loop";
export {
  EMPHASIS_VARIANTS,
  NON_LUMINOUS_EMPHASIS_VARIANTS,
  getAuraColor,
  getEmphasisInnerAnimation,
  getEmphasisTextShadow,
  getEmphasisVariant,
  isDimEmphasisColor,
  isWhiteLikeColor,
} from "./lib/emphasis";
export type { EmphasisVariant } from "./lib/emphasis";
