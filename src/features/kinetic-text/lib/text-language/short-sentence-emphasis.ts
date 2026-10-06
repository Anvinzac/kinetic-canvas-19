/**
 * Short-sentence emphasis cap: a page of four words or fewer highlights exactly one word.
 *
 * Exports: SHORT_SENTENCE_MAX_WORDS, countSentenceWords, limitShortSentenceEmphasis
 * Depends on: text-language/vietnamese-phrases
 */

import { expandEmphasisToBoundPhrases, isLikelyVietnameseText } from "./vietnamese-phrases";

/** Pages with at most this many words carry a single highlighted word. */
export const SHORT_SENTENCE_MAX_WORDS = 4;

const HAS_GLYPH = /\p{L}|\p{N}/u;

/**
 * Words on a page, ignoring punctuation-only tokens such as "—" or "…".
 * @pure true
 */
export function countSentenceWords(words: string[]): number {
  return words.filter((word) => HAS_GLYPH.test(word)).length;
}

function letterCount(word: string): number {
  return word.match(/\p{L}|\p{N}/gu)?.length ?? 0;
}

/**
 * Reduce a short page's emphasis to one word. On a page of up to
 * SHORT_SENTENCE_MAX_WORDS words, only the first highlighted run survives, and within
 * it only one word: the longest token, widened to its whole bound phrase when it
 * belongs to one (even past the run's edge), or — in Vietnamese — paired with the run
 * neighbour the compound guard attached to it, so a two-syllable compound is never
 * split. Longer pages are returned unchanged.
 * @param words - page tokens
 * @param emphasized - indexes chosen by the selector, after compound repair
 * @param phraseKeys - extra data-annotated phrase keys treated as bound phrases
 * @returns At most one word's worth of indexes on short pages
 * @pure true
 */
export function limitShortSentenceEmphasis(
  words: string[],
  emphasized: Iterable<number>,
  phraseKeys?: readonly (readonly string[])[],
): Set<number> {
  const sorted = [...new Set(emphasized)].sort((left, right) => left - right);
  if (sorted.length <= 1 || countSentenceWords(words) > SHORT_SENTENCE_MAX_WORDS) {
    return new Set(sorted);
  }

  const run = [sorted[0]];
  for (const index of sorted.slice(1)) {
    if (index !== run[run.length - 1] + 1) break;
    run.push(index);
  }
  const inRun = new Set(run);

  // Earliest of the longest tokens: the content word, not a particle beside it.
  const anchor = run.reduce((best, index) =>
    letterCount(words[index]) > letterCount(words[best]) ? index : best,
  );

  // A known bound phrase is one word even where the compound guard paired the anchor
  // with a different neighbour ("im lặng nhé" → "im lặng", not "lặng nhé").
  const bound = expandEmphasisToBoundPhrases(words, [anchor], phraseKeys);
  if (bound.size > 1) return bound;

  if (isLikelyVietnameseText(words.join(" "))) {
    if (inRun.has(anchor - 1)) return new Set([anchor - 1, anchor]);
    if (inRun.has(anchor + 1)) return new Set([anchor, anchor + 1]);
  }
  return new Set([anchor]);
}
