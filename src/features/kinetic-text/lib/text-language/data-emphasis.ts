/**
 * Upstream (data-provided) emphasis phrase matching.
 *
 * Exports: getDataEmphasisWordIndexes, getDataEmphasisWordSpans, getEmphasisPhraseKeysForLayout, getEmphasizedRunPhraseKeys, getEmphasizedRunLayoutPhraseKeys
 * Depends on: text-language/vietnamese-phrases (compound token keys)
 */

import { getCompoundTokenKey } from "./vietnamese-phrases";

const HAN = /\p{Script=Han}/u;

/**
 * Split a data emphasis phrase into comparison keys.
 * @param phrase - raw annotation phrase
 * @returns NFC comparison keys per token, or null when the phrase cannot match safely
 */
function getEmphasisPhraseKeys(phrase: string): string[] | null {
  const tokens = phrase.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  // A Han annotation is written as one glued word ("诚实"), but a Han page tokenizes
  // per character — expand those tokens to one key per glyph so the phrase matches
  // the same units the packer and the renderer see.
  const keys = tokens.flatMap((token) =>
    HAN.test(token)
      ? // Glued punctuation ("诚实，") simply drops out; the glyphs keep the phrase whole.
        Array.from(token)
          .map(getCompoundTokenKey)
          .filter((key) => key.length > 0)
      : [getCompoundTokenKey(token)],
  );
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
  for (const span of getDataEmphasisWordSpans(words, dataEmphasis)) {
    for (let offset = 0; offset < span.length; offset += 1) matches.add(span.start + offset);
  }
  return matches;
}

/**
 * Map data emphasis phrases to their exact token spans in `words`, grouped by
 * annotation. Spans come out in annotation order first, then text order, so a
 * caller can cap the page by highlighted WORDS: taking the first N spans keeps
 * the author's highest-priority annotations, and two adjacent phrases are
 * never counted as one word just because their indexes touch.
 * @param words - tokenized stage text
 * @param dataEmphasis - optional upstream annotation phrases
 * @returns Matched spans (empty when nothing matches)
 */
export function getDataEmphasisWordSpans(
  words: string[],
  dataEmphasis?: string[],
): Array<{ start: number; length: number }> {
  const spans: Array<{ start: number; length: number }> = [];
  if (!dataEmphasis?.length || words.length === 0) return spans;

  const phrases = dataEmphasis
    .map((phrase) => getEmphasisPhraseKeys(phrase))
    .filter((keys): keys is string[] => keys !== null);
  if (!phrases.length) return spans;

  const wordKeys = words.map(getCompoundTokenKey);

  for (const phraseKeys of phrases) {
    for (let start = 0; start + phraseKeys.length <= wordKeys.length; start += 1) {
      if (phraseKeys.every((key, offset) => wordKeys[start + offset] === key)) {
        spans.push({ start, length: phraseKeys.length });
      }
    }
  }

  return spans;
}

/**
 * Convert data emphasis phrases into the token-key form the bound-phrase helpers
 * compare against, so an annotated compound ("thực sự") is treated as one
 * unbreakable word by line packing and shared emphasis styling.
 * @param dataEmphasis - optional upstream annotation phrases
 * @returns Diacritic-preserving token keys per usable phrase
 */
export function getEmphasisPhraseKeysForLayout(dataEmphasis?: string[]): string[][] {
  if (!dataEmphasis?.length) return [];
  return dataEmphasis
    .map((phrase) => getEmphasisPhraseKeys(phrase))
    .filter((keys): keys is string[] => keys !== null);
}

/**
 * Token keys for every highlighted run of two or more adjacent tokens.
 *
 * The selection layer already decided that a run reads as ONE word — through the
 * curated bound-phrase list, a compound repair, or two neighbouring picks — but
 * only the annotated phrases reach the layout and styling helpers as keys. Without
 * the runs here, a compound can still be packed onto two lines and, once split, each
 * syllable hashes its own emphasis effect. Registering the run as a bound phrase
 * makes that decision visible to everything downstream: unbreakable line packing and
 * one shared effect across all its syllables.
 * @param words - tokenized page text
 * @param emphasized - highlighted token indexes
 * @returns One diacritic-preserving key list per run of two or more tokens
 * @pure true
 */
export function getEmphasizedRunPhraseKeys(words: string[], emphasized: Set<number>): string[][] {
  // Runs break on a token with no letter or number, exactly like the renderers'
  // grouping, so trailing punctuation or a masked "_____" blank never joins a phrase.
  const hasGlyph = (word: string) => /\p{L}|\p{N}/u.test(word);
  const runs: string[][] = [];
  let run: string[] = [];

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index] ?? "";
    if (emphasized.has(index) && hasGlyph(word)) {
      run.push(getCompoundTokenKey(word));
      continue;
    }
    if (run.length >= 2) runs.push(run);
    run = [];
  }
  if (run.length >= 2) runs.push(run);

  return runs;
}

/**
 * The run keys the LINE PACKER may treat as unbreakable: runs of at most two tokens.
 *
 * A run of three or more highlighted tokens is a sweep of a sentence, not a compound.
 * Glued whole it becomes an unbreakable block eight or ten em wide that no number of
 * extra lines can fit at reading size — the very cram the measured layout exists to
 * avoid. Splitting one across lines costs only its shared emphasis effect, which the
 * full keys keep anyway: every syllable still hashes one effect whether or not they
 * share a line. Words the data authored long ("Phan_Xi_Păng") reach the packer through
 * `boundPhrases`, at any length, and stay unbreakable.
 * @param words - tokenized page text
 * @param emphasized - highlighted token indexes
 * @returns The run keys of two tokens or fewer
 * @pure true
 */
export function getEmphasizedRunLayoutPhraseKeys(
  words: string[],
  emphasized: Set<number>,
): string[][] {
  return getEmphasizedRunPhraseKeys(words, emphasized).filter((keys) => keys.length <= 2);
}
