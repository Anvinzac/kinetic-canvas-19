export const DEFAULT_TEXT_PAGE_WORD_LIMIT = 7;
export const VIETNAMESE_TEXT_PAGE_WORD_LIMIT = 10;

export type WordLine = {
  indentCh: number;
  words: Array<{ text: string; index: number }>;
};

// Vietnamese kinetic text reads as a left-aligned text block. Each wrapped line
// steps forward in a strict 0ch -> 2ch -> 3ch -> 4ch sequence. After that, it
// stays at 4ch so lower rows keep enough room for complete words.
const VIETNAMESE_LINE_INDENTS_CH = [0, 2, 3, 4] as const;
const VIETNAMESE_MAX_LINE_CHARS = 12;

export function getTextPageWordLimit(text: string) {
  return isLikelyVietnameseText(text)
    ? VIETNAMESE_TEXT_PAGE_WORD_LIMIT
    : DEFAULT_TEXT_PAGE_WORD_LIMIT;
}

export function isLikelyVietnameseText(text: string) {
  return (
    /[ăâđêôơưĂÂĐÊÔƠƯ]/.test(text) || /[\u0300\u0301\u0303\u0309\u0323]/.test(text.normalize("NFD"))
  );
}

export function getVietnameseWordLines(words: string[]): WordLine[] {
  if (words.length === 0) return [];

  const lines: WordLine[] = [];
  let currentWords: WordLine["words"] = [];
  let currentTextLength = 0;

  for (let index = 0; index < words.length; index += 1) {
    const text = words[index];
    const nextLength = getVisibleWordLength(text);
    const indentCh = getVietnameseLineIndent(lines.length);
    const lineCapacity = getVietnameseLineCapacity(indentCh);
    const projectedLength = currentTextLength + (currentWords.length > 0 ? 1 : 0) + nextLength;

    if (currentWords.length > 0 && projectedLength > lineCapacity) {
      lines.push({
        indentCh,
        words: currentWords,
      });
      currentWords = [];
      currentTextLength = 0;
    }

    currentWords.push({ text, index });
    currentTextLength += (currentWords.length > 1 ? 1 : 0) + nextLength;
  }

  if (currentWords.length > 0) {
    lines.push({
      indentCh: getVietnameseLineIndent(lines.length),
      words: currentWords,
    });
  }

  return lines;
}

function getVietnameseLineIndent(lineIndex: number) {
  return VIETNAMESE_LINE_INDENTS_CH[Math.min(lineIndex, VIETNAMESE_LINE_INDENTS_CH.length - 1)];
}

function getVietnameseLineCapacity(indentCh: number) {
  return Math.max(6, VIETNAMESE_MAX_LINE_CHARS - indentCh);
}

function getVisibleWordLength(word: string) {
  return Array.from(word.normalize("NFC")).length;
}
