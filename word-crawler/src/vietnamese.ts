/**
 * Vietnamese orthography — deciding whether text really is Vietnamese.
 *
 * Responsibility: one place that answers "is this token a Vietnamese syllable,
 * and does this text read as Vietnamese at all?", so the annotation contract,
 * the deck validator and the bench all enforce the same rule.
 *
 * Why a syllable validator rather than a word list: Vietnamese spelling is a
 * closed system. Every syllable is (onset)(nucleus)(coda) drawn from fixed
 * inventories, with a tone mark on the nucleus. A token that cannot be parsed
 * that way is not a Vietnamese word, whatever it is — which catches "female",
 * "knowledge" and "research" without anybody listing them. The inventories
 * below are deliberately GENEROUS: combinations that do not occur in real
 * Vietnamese ("aic") still parse, because over-accepting leaves good Vietnamese
 * alone while under-accepting would flag it as foreign. Only `f`, `j`, `w`, `z`
 * and consonant clusters alien to Vietnamese are rejected outright.
 *
 * Short English words that happen to fit the pattern ("the", "man", "can") are
 * invisible to the shape check by construction, so {@link findForeignTokens}
 * also consults a small list of unambiguous English markers, and
 * {@link diacriticRatio} catches accent-stripped Vietnamese, which parses
 * perfectly and is still wrong ("Chat long trong suot").
 *
 * Exports: VIETNAMESE_ONSETS, VIETNAMESE_NUCLEI, VIETNAMESE_CODAS,
 *          ENGLISH_MARKER_WORDS, DIACRITIC_RATIO_FLOOR, stripTones,
 *          hasVietnameseMark, isVietnameseSyllable, vietnameseTokens,
 *          diacriticRatio, findForeignTokens, findEnglishMarkers,
 *          checkVietnameseText
 * Depends on: none
 */

/**
 * Written onsets (initial consonants). `qu` and the `ngh`/`gh`/`gi` digraphs
 * are listed in full; `f`, `j`, `w` and `z` are absent because Vietnamese does
 * not use them.
 */
export const VIETNAMESE_ONSETS: readonly string[] = [
  "ngh",
  "nh",
  "ng",
  "ch",
  "gh",
  "gi",
  "kh",
  "ph",
  "qu",
  "th",
  "tr",
  "b",
  "c",
  "d",
  "đ",
  "g",
  "h",
  "k",
  "l",
  "m",
  "n",
  "p",
  "r",
  "s",
  "t",
  "v",
  "x",
];

/**
 * Written nuclei, tone marks removed: single vowels, diphthongs and
 * triphthongs. Longest forms must be matched first, which is why the list is
 * ordered by descending length.
 */
export const VIETNAMESE_NUCLEI: readonly string[] = [
  // Triphthongs and the long rising glides.
  "uyê",
  "iêu",
  "yêu",
  "ươi",
  "ươu",
  "uôi",
  "oai",
  "oay",
  "oao",
  "oeo",
  "uây",
  "uai",
  "uay",
  "uya",
  "uyu",
  "ưoi",
  // Diphthongs.
  "iê",
  "yê",
  "uô",
  "ươ",
  "ưa",
  "ua",
  "ia",
  "ya",
  "oa",
  "oă",
  "oe",
  "oo",
  "ôô",
  "uâ",
  "uă",
  "uê",
  "uơ",
  "uy",
  "ai",
  "ao",
  "au",
  "ay",
  "âu",
  "ây",
  "eo",
  "êu",
  "iu",
  "oi",
  "ôi",
  "ơi",
  "ui",
  "ưi",
  "ưu",
  "ye",
  // Single vowels.
  "a",
  "ă",
  "â",
  "e",
  "ê",
  "i",
  "o",
  "ô",
  "ơ",
  "u",
  "ư",
  "y",
];

/** Written codas (final consonants). */
export const VIETNAMESE_CODAS: readonly string[] = ["ngh", "ng", "nh", "ch", "c", "m", "n", "p", "t"];

/**
 * English words the syllable check cannot see, because they are also
 * well-formed Vietnamese syllable shapes.
 *
 * The list is exactly that narrow. Every other English word — "people",
 * "something", "knowledge", "between" — is already unspellable in Vietnamese
 * and caught by {@link isVietnameseSyllable}, so listing it here would be dead
 * weight that hides what the list is actually for.
 *
 * Each entry must not be a Vietnamese word. That rules out a lot of tempting
 * additions: "than" is coal, "them" is "thêm", "man" is "màn", "can" is "căn",
 * "long", "song", "sang", "hang" and "tin" are all Vietnamese. Missing an
 * English leak is acceptable; flagging real Vietnamese is not.
 */
export const ENGLISH_MARKER_WORDS: ReadonlySet<string> = new Set([
  "the",
  "that",
  "then",
  "such",
  "much",
  "thing",
  "thin",
]);

/**
 * Minimum share of a Vietnamese text's syllables that must carry a
 * Vietnamese-only mark. Real Vietnamese prose sits far above this; an
 * accent-stripped sentence scores 0 while parsing as perfectly legal syllables.
 */
export const DIACRITIC_RATIO_FLOOR = 0.25;

/**
 * Combining tone marks: grave, acute, tilde, hook above, dot below. The letter
 * diacritics (breve on ă, circumflex on â/ê/ô, horn on ơ/ư) are NOT tones and
 * are kept, so "ặ" reduces to "ă" and not to "a".
 */
const TONE_MARKS = /[̣̀́̃̉]/gu;

/** Letters that only Vietnamese uses, independent of tone. */
const VIETNAMESE_LETTERS = /[ăâđêôơư]/u;

/**
 * Remove tone marks, keeping every letter distinction.
 *
 * @param textValue - any Vietnamese text or single token
 * @returns the same text with tones stripped ("tiếng" -> "tiêng")
 */
export function stripTones(textValue: string): string {
  return textValue.normalize("NFD").replace(TONE_MARKS, "").normalize("NFC");
}

/**
 * True when a token carries a tone mark or a Vietnamese-only letter.
 *
 * @param token - one word token
 */
export function hasVietnameseMark(token: string): boolean {
  const lower = token.toLowerCase();
  return VIETNAMESE_LETTERS.test(lower) || stripTones(lower) !== lower;
}

/** Longest-first alternation, so the regex prefers "ngh" over "ng" over "n". */
function alternation(parts: readonly string[]): string {
  return [...parts].sort((left, right) => right.length - left.length).join("|");
}

/**
 * `^(onset)?(nucleus)(coda)?$`. Anchored, so the engine backtracks until it
 * finds a parse if any parse exists.
 */
const SYLLABLE_PATTERN = new RegExp(
  `^(?:${alternation(VIETNAMESE_ONSETS)})?(?:${alternation(VIETNAMESE_NUCLEI)})(?:${alternation(VIETNAMESE_CODAS)})?$`,
  "u",
);

/**
 * True when a token is spelled like a Vietnamese syllable.
 *
 * Tone marks are removed first, so "nghiêng" and "người" are tested as
 * "nghiêng" and "ngươi". Digits and empty tokens are not syllables.
 *
 * @param token - one word token, without surrounding punctuation
 * @returns whether Vietnamese orthography can spell this token
 */
export function isVietnameseSyllable(token: string): boolean {
  const normalized = stripTones(token.normalize("NFC").toLowerCase());
  if (normalized.length === 0) return false;
  if (!/^[\p{L}]+$/u.test(normalized)) return false;
  return SYLLABLE_PATTERN.test(normalized);
}

/**
 * Split text into word tokens, dropping emphasis markers and punctuation.
 *
 * Hyphens and apostrophes split too: a Vietnamese syllable never contains one,
 * so "e-mail" is judged as "e" plus "mail" and the foreign half is caught.
 *
 * @param textValue - Vietnamese text, with or without `/marker/` pairs
 * @returns the letter/digit tokens, in order
 */
export function vietnameseTokens(textValue: string): string[] {
  return textValue.match(/[\p{L}\p{N}]+/gu) ?? [];
}

/**
 * Share of a text's tokens that carry a Vietnamese mark.
 *
 * @param textValue - Vietnamese text, with or without `/marker/` pairs
 * @returns ratio in 0..1; 0 for text with no tokens
 */
export function diacriticRatio(textValue: string): number {
  const tokens = vietnameseTokens(textValue);
  if (tokens.length === 0) return 0;
  return tokens.filter(hasVietnameseMark).length / tokens.length;
}

/**
 * Tokens that Vietnamese orthography cannot spell.
 *
 * @param textValue - the Vietnamese text as written by the model
 * @returns the offending tokens, lowercased, deduplicated, in order
 */
export function findForeignTokens(textValue: string): string[] {
  const found = new Set<string>();
  for (const token of vietnameseTokens(textValue)) {
    if (/\p{N}/u.test(token)) continue;
    if (!isVietnameseSyllable(token)) found.add(token.toLowerCase());
  }
  return [...found];
}

/**
 * English words that pass the syllable check but cannot be Vietnamese.
 *
 * @param textValue - the Vietnamese text as written by the model
 * @returns the offending tokens, lowercased and deduplicated
 */
export function findEnglishMarkers(textValue: string): string[] {
  const found = new Set<string>();
  for (const token of vietnameseTokens(textValue)) {
    const key = token.toLowerCase();
    if (ENGLISH_MARKER_WORDS.has(key)) found.add(key);
  }
  return [...found];
}

/**
 * Every way a Vietnamese field can fail to be Vietnamese, in one report.
 *
 * Advisory only: nothing here can be repaired without writing the Vietnamese
 * again, so the caller reports it and the bench scores it.
 *
 * @param field - field name used to prefix each issue
 * @param textValue - the Vietnamese text as written by the model
 * @returns human-readable issues (empty when the text reads as Vietnamese)
 */
export function checkVietnameseText(field: string, textValue: string): string[] {
  if (textValue.trim().length === 0) return [];
  const issues: string[] = [];

  const foreign = findForeignTokens(textValue);
  if (foreign.length > 0) {
    issues.push(
      `${field}: ${foreign.length} token(s) are not Vietnamese words: ${foreign.slice(0, 6).join(", ")}`,
    );
  }

  const english = findEnglishMarkers(textValue);
  if (english.length > 0) {
    issues.push(`${field}: English word(s) in Vietnamese text: ${english.join(", ")}`);
  }

  const ratio = diacriticRatio(textValue);
  if (ratio < DIACRITIC_RATIO_FLOOR) {
    issues.push(
      `${field}: only ${Math.round(ratio * 100)}% of syllables carry a Vietnamese diacritic ` +
        `(floor ${Math.round(DIACRITIC_RATIO_FLOOR * 100)}%) — this reads as accent-stripped Vietnamese`,
    );
  }

  return issues;
}
