/**
 * Feed-player word emphasis selection (diverges from KineticText preview emphasis).
 *
 * Exports: getEmphasizedWordIndexes, getWordImportance
 * Depends on: features/kinetic-text expandEmphasis/getSpecialPoetic/getWords
 */

import {
  expandEmphasisToBoundPhrases,
  getSpecialPoeticWordIndexes,
  getWords,
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
export function getEmphasizedWordIndexes(words: string[]): Set<number> {
  const poeticIndexes = getSpecialPoeticWordIndexes(words);
  if (poeticIndexes.size > 0) return poeticIndexes;

  const candidates = words
    .map((word, index) => ({
      index,
      score: getWordImportance(word, index, words.length),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const desiredCount = Math.min(2, Math.max(1, Math.ceil(words.length / 4)));
  const selected = candidates.slice(0, desiredCount).map((item) => item.index);
  if (selected.length === 0 && words.length > 0) selected.push(words.length - 1);
  return expandEmphasisToBoundPhrases(words, selected);
}


// Feed scoring — includes digit punchline + ALLCAPS bonuses and a wider EMPHASIS_WORDS
// set than KineticText getPreviewWordImportance. Do not unify.
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

