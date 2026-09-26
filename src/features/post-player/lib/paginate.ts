/**
 * Pure helpers for sentence-safe text pagination.
 *
 * Exports: paginateText
 * Depends on: @/features/kinetic-text
 */

import { getTextPageWordLimit, getWords, isLikelyVietnameseText } from "@/features/kinetic-text";

type RawTextPage = { text: string; mergeable: boolean };

/** Word-index span `[start, end)` of one compound `word - word` phrase. */
type CompoundPhraseSpan = { start: number; end: number };

/** How strongly a token ends a clause: `;`, `:`, `—` are strong; `,` is weak. */
type ClauseBreakKind = "strong" | "weak" | "none";

const MIN_STANDALONE_PAGE_WORDS = 3;

/**
 * A sentence only earns a clause break once it reaches this multiple of the
 * page word budget (Vietnamese 20+ words, English 14+ words). The budget
 * itself is a soft preference — text is never split at an arbitrary word count.
 */
const LONG_SENTENCE_WORD_MULTIPLIER = 2;

/** Standalone `-` / `–` tokens glue words into one compound phrase. */
const COMPOUND_HYPHEN_PATTERN = /^[-–]+$/;

/** Strong clause endings (`;`, `:`, em-dash) that may end a page on a long sentence. */
const STRONG_CLAUSE_ENDING_PATTERN = /(?:[;:]|—+|--+)["')\]]*$/;

/** Weak clause endings (`,`): never a page end — commas sit inside clauses. */
const WEAK_CLAUSE_ENDING_PATTERN = /,["')\]]*$/;

/** Vietnamese colon intros (e.g. `Nhỏ thôi:`) stay glued to their clause. */
const VIETNAMESE_COLON_ENDING_PATTERN = /:["')\]]*$/;

/** Vietnamese conjunctions that may open a page in a very long sentence. */
const VIETNAMESE_CLAUSE_CONJUNCTIONS = [
  "nhưng",
  "tuy nhiên",
  "mặc dù",
  "vì",
  "nên",
  "và",
  "hoặc",
  "hay",
] as const;

/**
 * Comparable token keys for the conjunctions above. Matching keeps diacritics
 * on purpose: stripping them would let "những" match "nhưng" — or "nền" match
 * "nên" — and split a sentence at the wrong word.
 */
const VIETNAMESE_CLAUSE_CONJUNCTION_KEYS = VIETNAMESE_CLAUSE_CONJUNCTIONS.map((phrase) =>
  phrase.split(/\s+/).map(getComparableToken),
);

/**
 * Split status / canvas text into kinetic page strings.
 * Sentences always stay whole; only very long sentences may open a new page
 * (see splitSentenceIntoPages for the exact rules).
 * @param text - text argument
 * @returns Ordered page strings; empty input → `[""]`
 */
export function paginateText(text: string): string[] {
  const blocks = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((block) => block.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
  if (blocks.length === 0) return [""];

  return mergeShortTextPages(blocks.flatMap((block) => paginateTextBlock(block)));
}

/**
 * Paginate one non-empty block of text.
 * Language is detected once per block, then every sentence is split
 * independently so a page break can never cut across sentences.
 * @param text - trimmed block text
 * @returns Raw pages for the block, before anti-orphan merging
 */
function paginateTextBlock(text: string): RawTextPage[] {
  const wordLimit = getTextPageWordLimit(text);
  const isVietnamese = isLikelyVietnameseText(text);
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [text];
  return sentences
    .flatMap((sentence) => splitSentenceIntoPages(sentence.trim(), wordLimit, isVietnamese))
    .filter((page) => page.text);
}

/**
 * Split one sentence into page strings. This replaces the old word-budget
 * chunker: a sentence stays whole on one page; only a very long sentence
 * (≥ 2× the word budget) may open a new page, and only at a major clause
 * boundary — never at an arbitrary word count, a comma, or inside a bonded
 * Vietnamese / hyphen phrase.
 * @param sentence - trimmed sentence text
 * @param wordLimit - soft page word budget for the detected language
 * @param isVietnamese - true when the surrounding block is Vietnamese
 * @returns Pages; `mergeable` marks overflow continuations for the anti-orphan merge
 */
function splitSentenceIntoPages(
  sentence: string,
  wordLimit: number,
  isVietnamese: boolean,
): RawTextPage[] {
  const wholeSentencePage = [{ text: sentence, mergeable: false }];

  const words = getWords(sentence);
  if (words.length < wordLimit * LONG_SENTENCE_WORD_MULTIPLIER) return wholeSentencePage;

  const breakIndexes = getClauseBreakIndexes(words, isVietnamese);
  if (breakIndexes.length === 0) return wholeSentencePage;

  const chunks: string[] = [];
  let chunkStart = 0;
  for (const breakIndex of breakIndexes) {
    // Skip breaks that would strand a head chunk too short to stand alone
    // (first chunks are deliberate pages and never merge back).
    if (breakIndex - chunkStart < MIN_STANDALONE_PAGE_WORDS) continue;
    chunks.push(words.slice(chunkStart, breakIndex).join(" "));
    chunkStart = breakIndex;
  }
  if (chunkStart < words.length) chunks.push(words.slice(chunkStart).join(" "));
  if (chunks.length <= 1) return wholeSentencePage;

  // The first chunk heads the sentence (deliberate); later chunks are overflow
  // continuations that may merge back if they end up too short.
  return chunks.map((text, index) => ({ text, mergeable: index > 0 }));
}

/**
 * Word indexes where a new page may start inside a very long sentence.
 * A break either follows a strong clause ending (`;`, `:`, em-dash — colon
 * excluded for Vietnamese) or, for Vietnamese, opens at a conjunction like
 * `nhưng` / `và`. Breaks falling inside a compound `word - word` phrase are
 * dropped so hyphen phrases stay atomic.
 * @param words - sentence tokens
 * @param isVietnamese - true when the surrounding block is Vietnamese
 * @returns Sorted, de-duplicated break indexes (each becomes a page start)
 */
function getClauseBreakIndexes(words: string[], isVietnamese: boolean): number[] {
  const spans = collectCompoundPhraseSpans(words);
  const breakIndexes = new Set<number>();

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index] ?? "";
    if (canEndPageAfterWord(word, isVietnamese)) breakIndexes.add(index + 1);
    if (isVietnamese && isVietnameseClauseConjunctionAt(words, index)) breakIndexes.add(index);
  }

  return [...breakIndexes]
    .filter((breakIndex) => breakIndex > 0 && breakIndex < words.length)
    .filter((breakIndex) => !isInsideCompoundPhrase(breakIndex, spans))
    .sort((left, right) => left - right);
}

/**
 * Lowercase, punctuation-free token for conjunction matching. Diacritics are
 * preserved (with NFC unification) so distinct words never collide.
 * @param token - raw sentence token
 * @returns Comparable token made of letters and digits only
 */
function getComparableToken(token: string): string {
  return token
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

/**
 * True when `words[index]` opens a Vietnamese clause conjunction — either a
 * single word (`nhưng`, `và`, …) or a phrase (`tuy nhiên`, `mặc dù`).
 * Matching is case-insensitive with diacritics preserved, so the plural marker
 * "những" never matches the conjunction "nhưng".
 * @param words - sentence tokens
 * @param index - candidate conjunction start
 * @returns Whether the conjunction may open the next page
 */
function isVietnameseClauseConjunctionAt(words: string[], index: number): boolean {
  return VIETNAMESE_CLAUSE_CONJUNCTION_KEYS.some((phrase) => {
    if (index + phrase.length > words.length) return false;
    return phrase.every(
      (token, offset) => token === getComparableToken(words[index + offset] ?? ""),
    );
  });
}

/**
 * Clause-break strength classification. This replaces the old
 * `findLastNaturalBreakIndex` comma-retreat heuristic: strong breaks (`;`,
 * `:`, em-dash) may end a page for a very long sentence, weak breaks (`,`)
 * never do — commas sit inside clauses and Vietnamese meaning collapses when
 * a sentence is cut at one.
 * @param word - token to classify
 * @returns `"strong"`, `"weak"`, or `"none"`
 */
function getClauseBreakKind(word: string): ClauseBreakKind {
  if (STRONG_CLAUSE_ENDING_PATTERN.test(word)) return "strong";
  if (WEAK_CLAUSE_ENDING_PATTERN.test(word)) return "weak";
  return "none";
}

/**
 * True when a page may start right after `word`.
 * Vietnamese colon endings stay glued to their clause (`Nhỏ thôi: …`).
 * @param word - candidate clause-ending token
 * @param isVietnamese - true when the surrounding block is Vietnamese
 * @returns Whether a page break may follow this token
 */
function canEndPageAfterWord(word: string, isVietnamese: boolean): boolean {
  if (getClauseBreakKind(word) !== "strong") return false;
  if (isVietnamese && VIETNAMESE_COLON_ENDING_PATTERN.test(word)) return false;
  return true;
}

/**
 * Collect spans of compound `word - word` phrases (also `- word` / `word -`
 * edge shapes), mirroring how hyphen phrases are rendered as one unit.
 * @param words - sentence tokens
 * @returns Spans as `[start, end)` word indexes
 */
function collectCompoundPhraseSpans(words: string[]): CompoundPhraseSpan[] {
  const spans: CompoundPhraseSpan[] = [];

  for (let index = 0; index < words.length; ) {
    if (index + 2 < words.length && isCompoundHyphen(words[index + 1] ?? "")) {
      spans.push({ start: index, end: index + 3 });
      index += 3;
      continue;
    }

    if (index + 1 < words.length && isCompoundHyphen(words[index] ?? "")) {
      spans.push({ start: index, end: index + 2 });
      index += 2;
      continue;
    }

    index += 1;
  }

  return spans;
}

/**
 * True when `breakIndex` falls inside a compound phrase — such a break would
 * split a hyphen phrase across two pages.
 * @param breakIndex - candidate page start
 * @param spans - compound phrase spans for the sentence
 * @returns Whether the break index is inside a compound phrase
 */
function isInsideCompoundPhrase(breakIndex: number, spans: CompoundPhraseSpan[]): boolean {
  return spans.some((span) => span.start < breakIndex && breakIndex < span.end);
}

/**
 * Standalone `-` / `–` token that glues a compound phrase together.
 * Em-dashes (`—` / `--`) are clause separators, not compound glue.
 * @param word - token to test
 * @returns Whether the token is a compound hyphen
 */
function isCompoundHyphen(word: string): boolean {
  return COMPOUND_HYPHEN_PATTERN.test(word.trim());
}

// Anti-orphan: only overflow continuations may merge; deliberate pages stay.
function mergeShortTextPages(pages: RawTextPage[]) {
  const merged: RawTextPage[] = [];

  for (const page of pages) {
    const normalized = page.text.trim();
    if (!normalized) continue;

    // Pull a short page back ONLY when it is an overflow continuation of the
    // previous page — a deliberate short page (whole line / one-word reveal)
    // always keeps its own page.
    if (
      page.mergeable &&
      getWords(normalized).length < MIN_STANDALONE_PAGE_WORDS &&
      merged.length > 0
    ) {
      merged[merged.length - 1].text = joinTextPages(merged[merged.length - 1].text, normalized);
      continue;
    }

    merged.push({ text: normalized, mergeable: page.mergeable });
  }

  return merged.map((page) => page.text);
}

function joinTextPages(left: string, right: string) {
  return `${left.trim()} ${right.trim()}`.trim();
}
