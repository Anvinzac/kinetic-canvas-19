/**
 * Vietnamese kinetic line packing and page fit metrics.
 *
 * Exports: WordLine, WordSegment, getVietnameseWordLines, getVietnameseLayoutMetrics, char budget helpers
 * Depends on: text-language/vietnamese-phrases getBoundPhraseLength
 */

import { getBoundPhraseLength } from "./vietnamese-phrases";
import type {
  VietnameseLayoutMetrics,
  VietnameseLineLayoutOptions,
  WordLine,
  WordSegment,
} from "./types";

export type {
  VietnameseLayoutMetrics,
  VietnameseLineLayoutOptions,
  WordLine,
  WordSegment,
} from "./types";

// Vietnamese kinetic text reads as a left-aligned staggered block. Each deeper
// line steps in by a fraction of an em, so the stagger scales with the font and
// never collapses narrow pages.
const VIETNAMESE_LINE_INDENT_EM = [0, 0.22, 0.38, 0.5] as const;
const VIETNAMESE_MAX_LINE_CHARS = 9;
const VIETNAMESE_AVG_CHAR_WIDTH_EM = 0.58;
const VIETNAMESE_LINE_SIDE_PAD_EM = 0.12;
const VIETNAMESE_MIN_FIT_SCALE = 0.52;
// A thin column of single-word lines reads as unbalanced. Vietnamese meaningful
// words are usually two syllables, so a line should prefer to carry a pair. We
// never allow more than this many single-segment lines in a row.
const VIETNAMESE_MAX_CONSECUTIVE_SOLO_LINES = 3;
// How far the soft line capacity may stretch to pull a second segment up so the
// line isn't left as a single word. The gentle value applies everywhere (to
// discourage solo lines); the hard value is used once the consecutive-solo cap
// is reached and a pair must be forced.
const VIETNAMESE_PAIR_RELAX_CHARS = 3;
const VIETNAMESE_PAIR_FORCE_CHARS = 6;
/**
 * Inner content width for Vietnamese staggered layout.
 * @param canvasWidthPx - canvasWidthPx argument
 * @returns Usable inner width (≥ 200)
 */
export function getVietnameseCanvasInnerWidth(canvasWidthPx: number): number {
  return Math.max(200, canvasWidthPx * 0.92 - 32);
}

/**
 * Visible-character budget for one Vietnamese line at a given canvas width.
 * @param lineIndex - lineIndex argument
 * @param canvasInnerWidthPx - canvasInnerWidthPx argument
 * @param fontSizePx - fontSizePx argument
 * @returns Soft character capacity for that line
 */
export function getVietnameseCharBudgetForLine(
  lineIndex: number,
  canvasInnerWidthPx: number,
  fontSizePx: number,
): number {
  const indentEm = getVietnameseLineIndentEm(lineIndex);
  const availablePx =
    canvasInnerWidthPx -
    indentEm * fontSizePx -
    fontSizePx * VIETNAMESE_LINE_SIDE_PAD_EM;
  const charWidthPx = Math.max(fontSizePx * VIETNAMESE_AVG_CHAR_WIDTH_EM, 1);
  return Math.max(4, Math.floor(availablePx / charWidthPx));
}

/**
 * Pack lines using canvas width, then pre-shrink if any line still overflows.
 * @param words - words argument
 * @param canvasWidthPx - canvasWidthPx argument
 * @param fontSizePx - fontSizePx argument
 * @param visualScaleGuard - visualScaleGuard argument
 * @returns Lines + suggestedFitScale (≥ VIETNAMESE_MIN_FIT_SCALE)
 */
export function getVietnameseLayoutMetrics(
  words: string[],
  canvasWidthPx: number,
  fontSizePx: number,
  visualScaleGuard = 1,
): VietnameseLayoutMetrics {
  const innerWidth = getVietnameseCanvasInnerWidth(canvasWidthPx);
  const getLineCapacity = (lineIndex: number) =>
    getVietnameseCharBudgetForLine(lineIndex, innerWidth, fontSizePx);
  const lines = getVietnameseWordLines(words, { getLineCapacity });
  let suggestedFitScale = 1;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const visibleChars =
      line.segments.reduce((total, segment) => total + getSegmentVisibleLength(segment), 0) +
      Math.max(0, line.segments.length - 1);
    const capacity = getLineCapacity(lineIndex);
    const neededChars = visibleChars * Math.max(visualScaleGuard, 1);
    if (neededChars > capacity) {
      suggestedFitScale = Math.min(suggestedFitScale, (capacity / neededChars) * 0.96);
    }
  }

  return {
    lines,
    suggestedFitScale: Math.max(VIETNAMESE_MIN_FIT_SCALE, suggestedFitScale),
  };
}

/**
 * Pack Vietnamese words into indented staggered lines.
 * @param words - words argument
 * @param options? - options? argument
 * @returns WordLine array (empty when no words)
 */
export function getVietnameseWordLines(
  words: string[],
  options?: VietnameseLineLayoutOptions,
): WordLine[] {
  if (words.length === 0) return [];

  const segments = getVietnameseWordSegments(words);
  const lines: WordLine[] = [];
  let index = 0;
  let consecutiveSolo = 0;

  while (index < segments.length) {
    const capacity =
      options?.getLineCapacity?.(lines.length) ?? getVietnameseLineCapacity(lines.length);
    // Once we've stacked the max run of single-word lines, the next line must
    // carry a pair so the column can't grow any thinner.
    const forcePair = consecutiveSolo >= VIETNAMESE_MAX_CONSECUTIVE_SOLO_LINES;

    const lineSegments: WordSegment[] = [];
    let lineLength = 0;
    // Visual word count for the line. A bound phrase ("hình ảnh") is one segment
    // but two words, so a line holding it alone is already balanced — thinness is
    // measured in words, not segments.
    let lineWords = 0;

    while (index < segments.length) {
      const segment = segments[index];
      const segmentLength = getSegmentVisibleLength(segment);
      const segmentWords = segment.words.length;
      const projected = lineLength + (lineSegments.length > 0 ? 1 : 0) + segmentLength;

      // The first segment always lands on the line, however wide it is.
      if (lineSegments.length === 0) {
        lineSegments.push(segment);
        lineLength = segmentLength;
        lineWords = segmentWords;
        index += 1;
        continue;
      }

      // Within the soft capacity — keep filling.
      if (projected <= capacity) {
        lineSegments.push(segment);
        lineLength = projected;
        lineWords += segmentWords;
        index += 1;
        continue;
      }

      // Over capacity, but the line is still a single word. Reach a little
      // further to pull a partner up rather than leave a one-word line. The reach
      // is wider when a pair is being forced by the consecutive-solo cap.
      if (lineWords === 1) {
        const reach = capacity + (forcePair ? VIETNAMESE_PAIR_FORCE_CHARS : VIETNAMESE_PAIR_RELAX_CHARS);
        if (forcePair || projected <= reach) {
          lineSegments.push(segment);
          lineLength = projected;
          lineWords += segmentWords;
          index += 1;
        }
      }
      break;
    }

    lines.push({
      indentEm: getVietnameseLineIndentEm(lines.length),
      segments: lineSegments,
    });
    consecutiveSolo = lineWords === 1 ? consecutiveSolo + 1 : 0;
  }

  return lines;
}

function getVietnameseWordSegments(words: string[]): WordSegment[] {
  const segments: WordSegment[] = [];

  for (let index = 0; index < words.length; ) {
    // A bound phrase is one meaningful Vietnamese word (two syllables). It is
    // ALWAYS kept whole as a single, unbreakable segment — the line packer never
    // splits a segment, so a compound word can never straddle two lines. A phrase
    // wider than a line simply lands alone and the page font shrinks to fit it;
    // we never break the word to save space.
    const phraseLength = getBoundPhraseLength(words, index);
    const segmentWords = words.slice(index, index + phraseLength).map((text, offset) => ({
      text,
      index: index + offset,
    }));

    segments.push({
      key: segmentWords.map((word) => `${word.index}-${word.text}`).join("|"),
      words: segmentWords,
    });
    index += phraseLength;
  }

  return segments;
}

function getVietnameseLineIndentEm(lineIndex: number) {
  return VIETNAMESE_LINE_INDENT_EM[Math.min(lineIndex, VIETNAMESE_LINE_INDENT_EM.length - 1)];
}

function getVietnameseLineCapacity(lineIndex: number) {
  const step = Math.min(lineIndex, VIETNAMESE_LINE_INDENT_EM.length - 1);
  const indentEm = getVietnameseLineIndentEm(lineIndex);
  const indentCharCost = Math.round(indentEm * 4.8);
  return Math.max(4, VIETNAMESE_MAX_LINE_CHARS - step - indentCharCost);
}

function getVisibleWordLength(word: string) {
  return Array.from(word.normalize("NFC")).length;
}

function getSegmentVisibleLength(segment: WordSegment) {
  return segment.words.reduce(
    (total, word, index) => total + getVisibleWordLength(word.text) + (index > 0 ? 1 : 0),
    0,
  );
}
