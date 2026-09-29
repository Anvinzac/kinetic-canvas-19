/**
 * Vietnamese bound phrases, poetic emphasis keys, and phrase-aware emphasis helpers.
 *
 * Exports: expandEmphasisToBoundPhrases, getBoundPhrase*, getCompoundTokenKey, getSpecialPoeticWordIndexes, isLikelyVietnameseText, normalizeVietnameseToken, repairSplitCompoundEmphasis
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
export function getSpecialPoeticWordIndexes(words: string[]): Set<number> {
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
export function expandEmphasisToBoundPhrases(
  words: string[],
  selected: Iterable<number>,
  phraseKeys?: readonly (readonly string[])[],
): Set<number> {
  const expanded = new Set<number>();

  for (const index of selected) {
    let matchedPhrase = false;
    for (let start = 0; start <= index; start += 1) {
      const length = getBoundPhraseLength(words, start, phraseKeys);
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
 * @param phraseKeys - extra data-annotated phrase keys treated as bound phrases
 * @returns Anchor index for shared emphasis styling
 */
export function getBoundPhraseStartIndex(
  words: string[],
  index: number,
  phraseKeys?: readonly (readonly string[])[],
): number {
  for (let start = 0; start <= index; start += 1) {
    const length = getBoundPhraseLength(words, start, phraseKeys);
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
 * @param phraseKeys - extra data-annotated phrase keys treated as bound phrases
 * @returns Phrase string or single word used as emphasis seed
 */
export function getBoundPhraseEmphasisSeed(
  words: string[],
  index: number,
  phraseKeys?: readonly (readonly string[])[],
): string {
  const start = getBoundPhraseStartIndex(words, index, phraseKeys);
  const length = getBoundPhraseLength(words, start, phraseKeys);
  if (length > 1) {
    return words.slice(start, start + length).join(" ");
  }
  return words[index] ?? "";
}

/**
 * Compute boundphraselength.
 * @param words - words argument
 * @param startIndex - startIndex argument
 * @param phraseKeys - extra data-annotated phrase keys (diacritic-preserving) treated as bound
 * @returns Number of tokens the bound phrase starting at startIndex spans
 */
export function getBoundPhraseLength(
  words: string[],
  startIndex: number,
  phraseKeys: readonly (readonly string[])[] = [],
): number {
  const remaining = words.length - startIndex;
  let longestExtra = 0;
  for (const phrase of phraseKeys) longestExtra = Math.max(longestExtra, phrase.length);
  const maxLength = Math.min(Math.max(LONGEST_VIETNAMESE_BOUND_PHRASE, longestExtra), remaining);

  for (let length = maxLength; length > 1; length -= 1) {
    const slice = words.slice(startIndex, startIndex + length);
    const candidate = slice.map(normalizeVietnameseToken);

    if (
      VIETNAMESE_BOUND_PHRASE_KEYS.some(
        (phrase) =>
          phrase.length === length && phrase.every((token, index) => token === candidate[index]),
      )
    ) {
      return length;
    }

    // Data-annotated phrases (e.g. deck `emphasis` compounds like "thực sự") count
    // as bound too, compared through diacritic-preserving keys so "những" never
    // matches "nhưng".
    if (phraseKeys.length > 0) {
      const keyed = slice.map(getCompoundTokenKey);
      if (
        phraseKeys.some(
          (phrase) =>
            phrase.length === length && phrase.every((token, index) => token === keyed[index]),
        )
      ) {
        return length;
      }
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

/**
 * Heuristic: Vietnamese diacritics or known bound phrases.
 * Lives here so the compound-repair guard below can gate on it without a
 * circular import back into the text-language barrel.
 * @param text - text argument
 * @returns true when text looks Vietnamese
 */
export function isLikelyVietnameseText(text: string): boolean {
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

// Vietnamese function words that can never be one half of a compound word.
// Lookups go through getCompoundTokenKey, which keeps diacritics on purpose:
// accent-stripped keys would let "những" stand in for "nhưng" and make the
// content word "nền" collide with the function word "nên".
const VIETNAMESE_STOP_WORDS = new Set([
  "và",
  "là",
  "của",
  "có",
  "được",
  "trong",
  "cho",
  "với",
  "từ",
  "đến",
  "để",
  "do",
  "về",
  "theo",
  "tại",
  "qua",
  "ra",
  "lên",
  "xuống",
  "vào",
  "này",
  "đó",
  "các",
  "những",
  "một",
  "hai",
  "ba",
  "rất",
  "cũng",
  "đã",
  "đang",
  "sẽ",
  "không",
  "chưa",
  "còn",
  "nếu",
  "thì",
  "mà",
  "nhưng",
  "hay",
  "hoặc",
  "vì",
  "nên",
]);

// Sentence and clause punctuation can never sit inside a compound word. When
// the left token of a pair closes with one of these marks (quotes or brackets
// may follow), the next token opens a new clause instead of completing a pair.
const COMPOUND_JOIN_BREAKER = /[.!?…,;:]["'”’»)\]]*$/u;

/**
 * Lowercase, punctuation-free key for single-token matching. Diacritics are
 * preserved (NFC-unified) on purpose: stripping them would collapse distinct
 * words like "nền"/"nên" or "những"/"nhưng" onto one key.
 * @param token - raw word token
 * @returns Comparison key made of letters and digits only
 */
export function getCompoundTokenKey(token: string): string {
  return token
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

/**
 * True when two adjacent syllables plausibly form one Vietnamese compound
 * word: both are content syllables (at least 2 letters, outside the stop-word
 * set) and no clause punctuation separates them.
 * @param left - left syllable of the pair
 * @param right - right syllable of the pair
 * @returns Whether the pair looks like one compound word
 */
function isLikelyCompoundPair(left: string, right: string): boolean {
  const leftKey = getCompoundTokenKey(left);
  if (leftKey.length < 2 || VIETNAMESE_STOP_WORDS.has(leftKey)) return false;

  const rightKey = getCompoundTokenKey(right);
  if (rightKey.length < 2 || VIETNAMESE_STOP_WORDS.has(rightKey)) return false;

  return !COMPOUND_JOIN_BREAKER.test(left);
}

/**
 * Bounds-checked compound test for the pair starting at `leftIndex`.
 * @param words - words argument
 * @param leftIndex - index of the left syllable
 * @returns Whether words[leftIndex] + words[leftIndex + 1] look like a compound
 */
function isLikelyCompoundPairAt(words: string[], leftIndex: number): boolean {
  if (leftIndex < 0 || leftIndex + 1 >= words.length) return false;
  return isLikelyCompoundPair(words[leftIndex], words[leftIndex + 1]);
}

/**
 * @responsibility Repair emphasis that splits a likely Vietnamese compound word.
 * @inputs Words + emphasized indexes (call only for Vietnamese text)
 * @outputs Emphasized indexes with the missing compound syllable added
 * @pure true
 */
// Vietnamese compound words are written as syllable pairs ("học sinh", "bệnh
// viện") and most never appear in VIETNAMESE_BOUND_PHRASES, so scoring can
// leave one syllable glowing on its own. This second pass runs AFTER
// expandEmphasisToBoundPhrases and pulls in an adjacent syllable whenever the
// pair still reads as one compound. Expansion stops at pairs: each originally
// selected index adds at most one syllable to its left and one to its right, so
// chains of content syllables never cascade across the sentence.
/**
 * repairSplitCompoundEmphasis helper
 * @param words - words argument
 * @param emphasizedIndices - emphasizedIndices argument
 * @returns Deduplicated ascending emphasized indexes
 */
export function repairSplitCompoundEmphasis(
  words: string[],
  emphasizedIndices: number[],
): number[] {
  const emphasized = new Set(emphasizedIndices);
  if (!isLikelyVietnameseText(words.join(" "))) {
    return [...emphasized].sort((left, right) => left - right);
  }

  const repaired = new Set(emphasized);
  for (const index of emphasized) {
    if (index < 0 || index >= words.length) continue;

    // Only orphan syllables reach for a partner. A selection that already sits
    // next to a highlighted syllable is a complete compound run — reaching out
    // from either side would drag neighbouring words ("cứ", "mãi") into the
    // highlight and blow past the two-words-per-page cap.
    const hasLeftPartner = emphasized.has(index - 1);
    const hasRightPartner = emphasized.has(index + 1);

    if (!hasLeftPartner && !hasRightPartner) {
      const left = index - 1;
      if (!emphasized.has(left) && isLikelyCompoundPairAt(words, left)) repaired.add(left);

      const right = index + 1;
      if (!emphasized.has(right) && isLikelyCompoundPairAt(words, right - 1)) repaired.add(right);
    }
  }

  return [...repaired].sort((left, right) => left - right);
}
