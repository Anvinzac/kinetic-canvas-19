/**
 * Preview-only emphasis scoring for KineticText (diverges from PostCard).
 *
 * Exports: getPreviewEmphasizedWordIndexes
 * Depends on: text-language poetic/bound phrase helpers
 */

import {
  expandEmphasisToBoundPhrases,
  getSpecialPoeticWordIndexes,
} from "../lib/text-language";

// Preview emphasis scoring — narrower word list / no digit-or-ALLCAPS bonuses.
// PostCard getEmphasizedWordIndexes + getWordImportance diverge; do not unify.
export function getPreviewEmphasizedWordIndexes(words: string[]) {
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
  if (selected.length === 0 && words.length > 0) {
    return expandEmphasisToBoundPhrases(words, [words.length - 1]);
  }
  return expandEmphasisToBoundPhrases(
    words,
    selected.map((item) => item.index),
  );
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
