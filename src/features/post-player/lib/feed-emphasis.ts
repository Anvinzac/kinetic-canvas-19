/**
 * Feed-player word emphasis selection (diverges from KineticText preview emphasis).
 *
 * Exports: getEmphasizedWordIndexes, getWordImportance
 * Depends on: features/kinetic-text emphasis + Vietnamese compound-repair helpers
 */

import {
  expandEmphasisToBoundPhrases,
  getDataEmphasisWordSpans,
  getEmphasisPhraseKeysForLayout,
  getSpecialPoeticWordIndexes,
  getWords,
  isLikelyVietnameseText,
  repairSplitCompoundEmphasis,
} from "@/features/kinetic-text";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "so",
  "the",
  "to",
  "you",
  "your",
]);

const EMPHASIS_WORDS = new Set([
  "archive",
  "breathe",
  "count",
  "draft",
  "drafts",
  "fade",
  "feeling",
  "first",
  "frame",
  "glowing",
  "honest",
  "idea",
  "important",
  "landing",
  "louder",
  "memory",
  "motion",
  "pause",
  "proof",
  "protect",
  "replay",
  "rhythm",
  "sentence",
  "spark",
  "surprise",
  "timing",
  "work",
]);

// Feed emphasis selection — selection fallback and getWordImportance scoring diverge
// from KineticText getPreviewEmphasizedWordIndexes / getPreviewWordImportance.
/**
 * Keep at most two highlighted words on a page. A highlighted word is one
 * contiguous run of emphasized tokens (a compound counts as one word); runs are
 * kept in text order, and a non-empty input never shrinks below one run.
 * @param indexes - emphasized token indexes
 * @returns The indexes of the first two runs
 */
function keepFirstTwoRuns(indexes: Iterable<number>): Set<number> {
  const runs: number[][] = [];
  for (const index of [...indexes].sort((left, right) => left - right)) {
    const last = runs[runs.length - 1];
    if (last && index === last[last.length - 1] + 1) last.push(index);
    else runs.push([index]);
  }
  return new Set(runs.slice(0, 2).flat());
}

/**
 * Compute emphasizedwordindexes.
 * @param words - words argument
 * @param dataEmphasis - optional upstream annotation phrases; exact matches win over scoring
 * @returns Computed value
 */
export function getEmphasizedWordIndexes(words: string[], dataEmphasis?: string[]): Set<number> {
  const isVietnameseText = isLikelyVietnameseText(words.join(" "));
  // Upstream annotations are author intent and outrank every heuristic. At most
  // two highlighted words per page: spans come back in annotation priority, so
  // the first two matched phrases win; each is already a whole compound, and the
  // expansion + repair defenses still heal single-syllable annotations.
  const spans = getDataEmphasisWordSpans(words, dataEmphasis);
  if (spans.length > 0) {
    const chosen = new Set<number>();
    for (const span of spans.slice(0, 2)) {
      for (let offset = 0; offset < span.length; offset += 1) chosen.add(span.start + offset);
    }
    const expanded = expandEmphasisToBoundPhrases(
      words,
      chosen,
      getEmphasisPhraseKeysForLayout(dataEmphasis),
    );
    if (!isVietnameseText) return expanded;
    return new Set(repairSplitCompoundEmphasis(words, [...expanded]));
  }

  const poeticIndexes = getSpecialPoeticWordIndexes(words);
  if (poeticIndexes.size > 0) return poeticIndexes;

  const candidates = words
    .map((word, index) => ({
      index,
      score: getWordImportance(word, index, words.length),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  // Whole-word emphasis is a Vietnamese notion (compound syllable pairs). English
  // spotlights a single word only, so scoring never selects two words there.
  const desiredCount = isVietnameseText ? Math.min(2, Math.max(1, Math.ceil(words.length / 4))) : 1;
  const selected = candidates.slice(0, desiredCount).map((item) => item.index);
  if (selected.length === 0 && words.length > 0) selected.push(words.length - 1);
  const expanded = expandEmphasisToBoundPhrases(words, selected);

  // Compound guard: never leave one syllable of a Vietnamese pair glowing alone.
  if (!isVietnameseText) return keepFirstTwoRuns(expanded);
  return keepFirstTwoRuns(repairSplitCompoundEmphasis(words, [...expanded]));
}

// Feed scoring — includes digit punchline + ALLCAPS bonuses and a wider EMPHASIS_WORDS
// set than KineticText getPreviewWordImportance. Do not unify.
/**
 * Compute wordimportance.
 * @param word - word argument
 * @param index - index argument
 * @param total - total argument
 * @returns Computed value
 */
export function getWordImportance(word: string, index: number, total: number): number {
  const cleaned = word.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
  if (!cleaned || STOP_WORDS.has(cleaned)) return 0;

  let score = 0;
  // A standalone number is the punchline of a clue sentence — a count, a
  // quantity, the fact the reader is meant to register. Always let the digits
  // win the emphasis (e.g. "Cả từ gồm 9 chữ cái." highlights the 9, never the
  // trailing noun), so it outscores every other bonus combined.
  if (/^\d+$/.test(cleaned)) score += 12;
  if (EMPHASIS_WORDS.has(cleaned)) score += 4;
  if (cleaned.length >= 8) score += 3;
  else if (cleaned.length >= 6) score += 2;
  if (index === total - 1 && cleaned.length > 3) score += 2;
  if (word === word.toUpperCase() && /[A-Z]/.test(word)) score += 2;
  return score;
}
