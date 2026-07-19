/**
 * Vietnamese bound phrases, poetic emphasis keys, and phrase-aware emphasis helpers.
 *
 * Exports: expandEmphasisToBoundPhrases, getBoundPhrase*, getSpecialPoeticWordIndexes, normalizeVietnameseToken
 * Depends on: none
 */

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
  "im lặng",
  "im lang",
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
export const VIETNAMESE_BOUND_PHRASE_KEYS = VIETNAMESE_BOUND_PHRASES.map((phrase) =>
  phrase.split(/\s+/).map(normalizeVietnameseToken),
);
export const VIETNAMESE_POETIC_EMPHASIS_KEYS = VIETNAMESE_POETIC_EMPHASIS_PHRASES.map((phrase) =>
  phrase.split(/\s+/).map(normalizeVietnameseToken),
);
const LONGEST_VIETNAMESE_BOUND_PHRASE = Math.max(
  ...VIETNAMESE_BOUND_PHRASE_KEYS.map((phrase) => phrase.length),
);

/**
 * Compute specialpoeticwordindexes.
 * @param words - words argument
 * @returns Computed value
 */
export function getSpecialPoeticWordIndexes(words: string[]): Set<number>{
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

/**
 * @responsibility Expand emphasis so bound Vietnamese phrases are never half-selected.
 * @inputs Words + selected indexes
 * @outputs Expanded index set covering whole bound phrases
 * @pure true
 */
// Never emphasize one syllable of a bound Vietnamese phrase — expand to the whole word.
/**
 * expandEmphasisToBoundPhrases helper
 * @param words - words argument
 * @param selected - selected argument
 * @returns Computed value
 */
export function expandEmphasisToBoundPhrases(words: string[], selected: Iterable<number>): Set<number> {
  const expanded = new Set<number>();

  for (const index of selected) {
    let matchedPhrase = false;
    for (let start = 0; start <= index; start += 1) {
      const length = getBoundPhraseLength(words, start);
      if (length > 1 && start <= index && index < start + length) {
        for (let offset = 0; offset < length; offset += 1) {
          expanded.add(start + offset);
        }
        matchedPhrase = true;
        break;
      }
    }
    if (!matchedPhrase) expanded.add(index);
  }

  return expanded;
}

/**
 * Start index of the bound phrase containing `index`, or `index` for a solo token.
 * @param words - words argument
 * @param index - index argument
 * @returns Anchor index for shared emphasis styling
 */
export function getBoundPhraseStartIndex(words: string[], index: number): number {
  for (let start = 0; start <= index; start += 1) {
    const length = getBoundPhraseLength(words, start);
    if (length > 1 && start <= index && index < start + length) {
      return start;
    }
  }
  return index;
}

/**
 * Stable label for emphasis styling — whole phrase for bound pairs, else the token.
 * @param words - words argument
 * @param index - index argument
 * @returns Phrase string or single word used as emphasis seed
 */
export function getBoundPhraseEmphasisSeed(words: string[], index: number): string {
  const start = getBoundPhraseStartIndex(words, index);
  const length = getBoundPhraseLength(words, start);
  if (length > 1) {
    return words.slice(start, start + length).join(" ");
  }
  return words[index] ?? "";
}

/**
 * Compute boundphraselength.
 * @param words - words argument
 * @param startIndex - startIndex argument
 * @returns Computed value
 */
export function getBoundPhraseLength(words: string[], startIndex: number): number {
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

/**
 * normalizeVietnameseToken helper
 * @param token - token argument
 * @returns Computed value
 */
export function normalizeVietnameseToken(token: string): string {
  return token
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, (letter) => (letter === "Đ" ? "D" : "d"))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}
