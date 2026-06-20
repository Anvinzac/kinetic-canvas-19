export const DEFAULT_TEXT_PAGE_WORD_LIMIT = 7;
export const VIETNAMESE_TEXT_PAGE_WORD_LIMIT = 10;

export type WordLine = {
  // Indent is expressed in em (relative to the font size) rather than fixed px so
  // it scales down together with the text. Fixed-px indents caused a collapse
  // feedback loop: a wide line shrank the font, but the px indent stayed put and
  // ate the narrowed line, forcing an even smaller font on deeper-wrapping pages.
  indentEm: number;
  segments: WordSegment[];
};

export type WordSegment = {
  key: string;
  words: Array<{ text: string; index: number }>;
};

// Vietnamese kinetic text reads as a left-aligned staggered block. Each deeper
// line steps in by a fraction of an em, so the stagger scales with the font and
// never collapses narrow pages.
const VIETNAMESE_LINE_INDENT_EM = [0, 0.22, 0.38, 0.5] as const;
const VIETNAMESE_MAX_LINE_CHARS = 9;
const VIETNAMESE_BOUND_PHRASES = [
  "ý tưởng",
  "y tuong",
  "lạnh lẽo",
  "lanh leo",
  "thông tin",
  "thong tin",
  "rõ ràng",
  "ro rang",
  "rơi nhịp",
  "roi nhip",
  "luận điểm",
  "luan diem",
  "hình ảnh",
  "hinh anh",
  "người đọc",
  "nguoi doc",
  "nội dung",
  "noi dung",
  "cảm xúc",
  "cam xuc",
  "khoảng thở",
  "khoang tho",
  "màn hình",
  "man hinh",
  "bài thử",
  "bai thu",
  "Hà Nội",
  "ha noi",
  "buổi sáng",
  "buoi sang",
  "hơi sương",
  "hoi suong",
  "Ao thu",
  "ao thu",
  "trong veo",
  "thuyền câu",
  "thuyen cau",
  "tẻo teo",
  "teo teo",
  "sóng biếc",
  "song biec",
  "lá vàng",
  "la vang",
  "tầng mây",
  "tang may",
  "xanh ngắt",
  "xanh ngat",
  "ngõ trúc",
  "ngo truc",
  "tựa gối",
  "tua goi",
] as const;
const VIETNAMESE_BOUND_PHRASE_KEYS = VIETNAMESE_BOUND_PHRASES.map((phrase) =>
  phrase.split(/\s+/).map(normalizeVietnameseToken),
);
const LONGEST_VIETNAMESE_BOUND_PHRASE = Math.max(
  ...VIETNAMESE_BOUND_PHRASE_KEYS.map((phrase) => phrase.length),
);

export function getTextPageWordLimit(text: string) {
  return isLikelyVietnameseText(text)
    ? VIETNAMESE_TEXT_PAGE_WORD_LIMIT
    : DEFAULT_TEXT_PAGE_WORD_LIMIT;
}

export function isLikelyVietnameseText(text: string) {
  if (
    /[ăâđêôơưĂÂĐÊÔƠƯ]/.test(text) ||
    /[\u0300\u0301\u0303\u0309\u0323]/.test(text.normalize("NFD"))
  ) {
    return true;
  }

  const tokens = text.match(/\S+/g)?.map(normalizeVietnameseToken) ?? [];
  return VIETNAMESE_BOUND_PHRASE_KEYS.some((phrase) =>
    tokens.some(
      (_, index) =>
        index + phrase.length <= tokens.length &&
        phrase.every((token, phraseIndex) => token === tokens[index + phraseIndex]),
    ),
  );
}

export function getVietnameseWordLines(words: string[]): WordLine[] {
  if (words.length === 0) return [];

  const segments = getVietnameseWordSegments(words);
  const lines: WordLine[] = [];
  let currentSegments: WordSegment[] = [];
  let currentTextLength = 0;

  for (const segment of segments) {
    const nextLength = getSegmentVisibleLength(segment);
    const lineCapacity = getVietnameseLineCapacity(lines.length);
    const projectedLength = currentTextLength + (currentSegments.length > 0 ? 1 : 0) + nextLength;

    if (currentSegments.length > 0 && projectedLength > lineCapacity) {
      lines.push({
        indentEm: getVietnameseLineIndentEm(lines.length),
        segments: currentSegments,
      });
      currentSegments = [];
      currentTextLength = 0;
    }

    currentSegments.push(segment);
    currentTextLength += (currentSegments.length > 1 ? 1 : 0) + nextLength;
  }

  if (currentSegments.length > 0) {
    lines.push({
      indentEm: getVietnameseLineIndentEm(lines.length),
      segments: currentSegments,
    });
  }

  return lines;
}

function getVietnameseWordSegments(words: string[]): WordSegment[] {
  const segments: WordSegment[] = [];

  for (let index = 0; index < words.length; ) {
    // Bound phrases are kept together only when they still fit a line; otherwise a
    // single wide phrase would pin the whole page to a tiny font. Splitting on the
    // word boundary lets constrained pages wrap narrower and stay immersive.
    const boundLength = getBoundPhraseLength(words, index);
    const phraseLength =
      boundLength > 1 && getPhraseVisibleLength(words, index, boundLength) > VIETNAMESE_MAX_LINE_CHARS
        ? 1
        : boundLength;
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

function getPhraseVisibleLength(words: string[], startIndex: number, length: number) {
  let total = 0;
  for (let offset = 0; offset < length; offset += 1) {
    total += getVisibleWordLength(words[startIndex + offset]) + (offset > 0 ? 1 : 0);
  }
  return total;
}

function getBoundPhraseLength(words: string[], startIndex: number) {
  const remaining = words.length - startIndex;
  const maxLength = Math.min(LONGEST_VIETNAMESE_BOUND_PHRASE, remaining);

  for (let length = maxLength; length > 1; length -= 1) {
    const candidate = words.slice(startIndex, startIndex + length).map(normalizeVietnameseToken);

    if (
      VIETNAMESE_BOUND_PHRASE_KEYS.some(
        (phrase) =>
          phrase.length === length && phrase.every((token, index) => token === candidate[index]),
      )
    ) {
      return length;
    }
  }

  return 1;
}

function getVietnameseLineIndentEm(lineIndex: number) {
  return VIETNAMESE_LINE_INDENT_EM[Math.min(lineIndex, VIETNAMESE_LINE_INDENT_EM.length - 1)];
}

function getVietnameseLineCapacity(lineIndex: number) {
  const step = Math.min(lineIndex, VIETNAMESE_LINE_INDENT_EM.length - 1);
  return Math.max(6, VIETNAMESE_MAX_LINE_CHARS - step);
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

function normalizeVietnameseToken(token: string) {
  return token
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, (letter) => (letter === "Đ" ? "D" : "d"))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}
