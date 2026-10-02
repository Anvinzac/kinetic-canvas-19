/**
 * Preview-only emphasis scoring for KineticText (diverges from PostCard).
 *
 * Exports: getPreviewEmphasizedWordIndexes
 * Depends on: text-language poetic/bound-phrase + compound-repair helpers
 */

import {
  expandEmphasisToBoundPhrases,
  getEmphasisPhraseKeysForLayout,
  getDataEmphasisWordSpans,
  getSpecialPoeticWordIndexes,
  isLikelyVietnameseText,
  repairSplitCompoundEmphasis,
} from "../lib/text-language";

// Preview emphasis scoring — narrower word list / no digit-or-ALLCAPS bonuses.
// PostCard getEmphasizedWordIndexes + getWordImportance diverge; do not unify.
/**
 * Keep at most N highlighted runs. A run is one contiguous sequence of
 * emphasized tokens (a Vietnamese compound counts as one run).
 * @param indexes - emphasized token indexes
 * @param maxRuns - maximum number of runs to keep
 * @returns The indexes of the first N runs
 */
function keepFirstRuns(indexes: Iterable<number>, maxRuns: number): Set<number> {
  const runs: number[][] = [];
  for (const index of [...indexes].sort((left, right) => left - right)) {
    const last = runs[runs.length - 1];
    if (last && index === last[last.length - 1] + 1) last.push(index);
    else runs.push([index]);
  }
  return new Set(runs.slice(0, maxRuns).flat());
}

/**
 * Compute previewemphasizedwordindexes.
 * @param words - words argument
 * @param dataEmphasis - optional upstream annotation phrases; exact matches win over scoring
 * @returns Computed value
 */
export function getPreviewEmphasizedWordIndexes(
  words: string[],
  dataEmphasis?: string[],
): Set<number> {
  const isVietnameseText = isLikelyVietnameseText(words.join(" "));
  // Upstream annotations are author intent and outrank every heuristic. At most
  // two highlighted words per page: spans come back in annotation priority, so
  // the first two matched phrases win; each is already a whole compound, and the
  // expansion + repair defenses still heal single-syllable annotations.
  const spans = getDataEmphasisWordSpans(words, dataEmphasis);
  if (spans.length > 0) {
    const maxSpans = isVietnameseText ? 1 : 2;
    const chosen = new Set<number>();
    for (const span of spans.slice(0, maxSpans)) {
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
      score: getPreviewWordImportance(word, index, words.length),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  // Vietnamese spotlights a single word only; English spotlights a single word.
  const maxSelected = 1;
  const selected = candidates.slice(0, maxSelected);
  const expanded =
    selected.length === 0 && words.length > 0
      ? expandEmphasisToBoundPhrases(words, [words.length - 1])
      : expandEmphasisToBoundPhrases(
          words,
          selected.map((item) => item.index),
        );

  // Compound guard: never leave one syllable of a Vietnamese pair glowing alone.
  if (!isVietnameseText) return keepFirstRuns(expanded, 2);
  return keepFirstRuns(repairSplitCompoundEmphasis(words, [...expanded]), 1);
}

function getPreviewWordImportance(word: string, index: number, total: number) {
  const cleaned = word.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
  if (!cleaned || PREVIEW_STOP_WORDS.has(cleaned)) return 0;

  let score = 0;
  if (PREVIEW_EMPHASIS_WORDS.has(cleaned)) score += 4;
  if (cleaned.length >= 8) score += 3;
  else if (cleaned.length >= 6) score += 2;
  if (index === total - 1 && cleaned.length > 3) score += 2;
  return score;
}

const PREVIEW_STOP_WORDS = new Set([
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

const PREVIEW_EMPHASIS_WORDS = new Set([
  "breathe",
  "first",
  "frame",
  "glowing",
  "idea",
  "important",
  "motion",
  "pause",
  "replay",
  "rhythm",
  "sentence",
  "spark",
  "surprise",
  "timing",
]);
