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
const VIETNAMESE_POETIC_EMPHASIS_PHRASES = [
  "lơ lửng",
  "lo lung",
  "tẻo teo",
  "teo teo",
  "lạnh lẽo",
  "lanh leo",
  "trong veo",
  "sóng biếc",
  "song biec",
  "hơi gợn",
  "hoi gon",
  "lá vàng",
  "la vang",
  "khẽ đưa",
  "khe dua",
  "xanh ngắt",
  "xanh ngat",
  "vắng teo",
  "vang teo",
  "chân bèo",
  "chan beo",
  "hơi sương",
  "hoi suong",
  "khoảng thở",
  "khoang tho",
  "cảm xúc",
  "cam xuc",
] as const;
const VIETNAMESE_BOUND_PHRASE_KEYS = VIETNAMESE_BOUND_PHRASES.map((phrase) =>
  phrase.split(/\s+/).map(normalizeVietnameseToken),
);
const VIETNAMESE_POETIC_EMPHASIS_KEYS = VIETNAMESE_POETIC_EMPHASIS_PHRASES.map((phrase) =>
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
  let index = 0;
  let consecutiveSolo = 0;

  while (index < segments.length) {
    const capacity = getVietnameseLineCapacity(lines.length);
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

export function getSpecialPoeticWordIndexes(words: string[]) {
  const selected = new Set<number>();
  const normalizedWords = words.map(normalizeVietnameseToken);

  for (const phrase of VIETNAMESE_POETIC_EMPHASIS_KEYS) {
    for (let index = 0; index + phrase.length <= normalizedWords.length; index += 1) {
      if (phrase.every((token, offset) => token === normalizedWords[index + offset])) {
        for (let offset = 0; offset < phrase.length; offset += 1) {
          selected.add(index + offset);
        }
        return selected;
      }
    }
  }

  return selected;
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
