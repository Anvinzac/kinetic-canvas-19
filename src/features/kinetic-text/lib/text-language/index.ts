/**
 * Text-language public API — page limits, Vietnamese detection, layout, bound phrases.
 *
 * Exports: getTextPageWordLimit, isLikelyVietnameseText, layout + phrase helpers
 * Depends on: text-language/page-metrics, text-language/vietnamese-phrases
 */

import {
  VIETNAMESE_BOUND_PHRASE_KEYS,
  normalizeVietnameseToken,
} from "./vietnamese-phrases";

/** Default max words per English kinetic page. */
export const DEFAULT_TEXT_PAGE_WORD_LIMIT = 7;
/** Default max words per Vietnamese kinetic page. */
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
} from "./vietnamese-phrases";

/**
 * @responsibility Choose page word budget based on detected language.
 * @inputs Canvas / status text
 * @outputs VIETNAMESE_TEXT_PAGE_WORD_LIMIT or DEFAULT_TEXT_PAGE_WORD_LIMIT
 * @pure true
 */
export function getTextPageWordLimit(text: string) {
  return isLikelyVietnameseText(text)
    ? VIETNAMESE_TEXT_PAGE_WORD_LIMIT
    : DEFAULT_TEXT_PAGE_WORD_LIMIT;
}

/**
 * @responsibility Heuristic: Vietnamese diacritics or known bound phrases.
 * @inputs Free-form text
 * @outputs true when text looks Vietnamese
 * @pure true
 */
export function isLikelyVietnameseText(text: string) {
  if (
    /[ăâđêôơưĂÂĐÊÔƠƯ]/.test(text) ||
    /[\u0300\u0301\u0303\u0309\u0323]/.test(text.normalize("NFD"))
  ) {
    return true;
  }

  const tokens = text.match(/\S+/g)?.map(normalizeVietnameseToken) ?? [];
  return VIETNAMESE_BOUND_PHRASE_KEYS.some((phrase) =>
    tokens.some(
      (_, index) =>
        index + phrase.length <= tokens.length &&
        phrase.every((token, phraseIndex) => token === tokens[index + phraseIndex]),
    ),
  );
}
