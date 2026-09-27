/**
 * Upstream (data-provided) emphasis phrase matching.
 *
 * Exports: getDataEmphasisWordIndexes
 * Depends on: text-language/vietnamese-phrases (compound token keys)
 */

import { getCompoundTokenKey } from "./vietnamese-phrases";

/**
 * Split a data emphasis phrase into comparison keys.
 * @param phrase - raw annotation phrase
 * @returns NFC comparison keys per token, or null when the phrase cannot match safely
 */
function getEmphasisPhraseKeys(phrase: string): string[] | null {
  const tokens = phrase.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  const keys = tokens.map(getCompoundTokenKey);
  // Punctuation-only tokens ("—", "…") cannot anchor a meaningful emphasis
  // match, and silently dropping them would rewrite the phrase, so skip the
  // whole annotation instead.
  if (keys.some((key) => key.length === 0)) return null;
  return keys;
}

/**
 * Map data-provided emphasis phrases to exact token indexes in `words`.
 *
 * Matching is whole-token and consecutive: each annotation must occur as a run
 * of adjacent tokens, compared through NFC-normalized, lowercased,
 * punctuation-stripped keys that keep diacritics — "những" never matches
 * "nhưng" and "nền" never matches "nên". Punctuation at token boundaries
 * ("tĩnh," vs "tĩnh") is stripped safely. Every occurrence of every phrase is
 * matched; annotations absent from the text simply match nothing.
 *
 * @param words - tokenized stage text
 * @param dataEmphasis - optional upstream annotation phrases
 * @returns Matched token indexes (empty when nothing matches)
 */
export function getDataEmphasisWordIndexes(words: string[], dataEmphasis?: string[]): Set<number> {
  const matches = new Set<number>();
  if (!dataEmphasis?.length || words.length === 0) return matches;

  const phrases = dataEmphasis
    .map((phrase) => getEmphasisPhraseKeys(phrase))
    .filter((keys): keys is string[] => keys !== null);
  if (!phrases.length) return matches;

  const wordKeys = words.map(getCompoundTokenKey);

  for (const phraseKeys of phrases) {
    for (let start = 0; start + phraseKeys.length <= wordKeys.length; start += 1) {
      let matched = true;
      for (let offset = 0; offset < phraseKeys.length; offset += 1) {
        if (wordKeys[start + offset] !== phraseKeys[offset]) {
          matched = false;
          break;
        }
      }
      if (matched) {
        for (let offset = 0; offset < phraseKeys.length; offset += 1) {
          matches.add(start + offset);
        }
      }
    }
  }

  return matches;
}
