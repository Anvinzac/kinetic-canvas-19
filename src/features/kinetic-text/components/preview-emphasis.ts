/**
 * Preview-only emphasis scoring for KineticText (diverges from PostCard).
 *
 * Exports: getPreviewEmphasizedWordIndexes
 * Depends on: text-language poetic/bound-phrase + compound-repair helpers
 */

import {
  expandEmphasisToBoundPhrases,
  getDataEmphasisWordIndexes,
  getSpecialPoeticWordIndexes,
  isLikelyVietnameseText,
  repairSplitCompoundEmphasis,
} from "../lib/text-language";

// Preview emphasis scoring — narrower word list / no digit-or-ALLCAPS bonuses.
// PostCard getEmphasizedWordIndexes + getWordImportance diverge; do not unify.
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
  // Upstream annotations are author intent and outrank every heuristic: when at
  // least one data phrase occurs in this text, use exactly those indexes, then
  // keep the bound-phrase expansion + compound-repair defenses so a
  // partial-syllable annotation still heals into its compound.
  const dataIndexes = getDataEmphasisWordIndexes(words, dataEmphasis);
  if (dataIndexes.size > 0) {
    const expanded = expandEmphasisToBoundPhrases(words, dataIndexes);
    if (!isLikelyVietnameseText(words.join(" "))) return expanded;
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

  const selected = candidates.slice(0, Math.min(2, Math.max(1, Math.ceil(words.length / 4))));
  const expanded =
    selected.length === 0 && words.length > 0
      ? expandEmphasisToBoundPhrases(words, [words.length - 1])
      : expandEmphasisToBoundPhrases(
          words,
          selected.map((item) => item.index),
        );

  // Compound guard: never leave one syllable of a Vietnamese pair glowing alone.
  if (!isLikelyVietnameseText(words.join(" "))) return expanded;
  return new Set(repairSplitCompoundEmphasis(words, [...expanded]));
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
