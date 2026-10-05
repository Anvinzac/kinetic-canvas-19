/**
 * Vietnamese emphasis validation — the last quality gate before deck output.
 *
 * Responsibility: keep only emphasis phrases that can glow safely in the feed.
 * A phrase is kept when it:
 *   1. occurs in `defVi` or `leadVi` with the exact same characters
 *      (diacritics preserved — "mơ hồ" never matches "mo ho"),
 *   2. is not a function-word phrase,
 *   3. is not a single syllable that reads as half of a compound word
 *      ("sinh" inside "học sinh" is removed, "học sinh" is kept),
 *   4. does not overlap a phrase that was already kept in the same field — the
 *      longer run wins, because one field highlights one phrase.
 *
 * The rule for single syllables is deliberately conservative: an ambiguous
 * syllable is removed rather than trusted. Survivors are rewritten with the
 * source text's own casing so downstream consumers can match them verbatim.
 *
 * `injectEmphasisMarkers` then turns the survivors into the format the feed
 * actually reads: the phrase is wrapped in forward slashes inside the one field
 * where it occurs, because the app parses those markers per text field
 * (`parseEmphasisMarkers` in src/features/vocabulary/lib/stages.ts) and
 * highlights a single Vietnamese word per page.
 *
 * Exports: VIETNAMESE_STOP_WORDS, isVietnameseStopWord, emphasisTokenKey,
 *          countSyllables, validateEmphasis, injectEmphasisMarkers,
 *          stripEmphasisMarkers, EmphasisInput, EmphasisResult
 * Depends on: none
 */

/**
 * Vietnamese function words that can never be part of a highlight.
 * Matching keeps diacritics on purpose: an accent-stripped set would collapse
 * distinct words ("những" vs "nhưng", "nền" vs "nên") and start matching
 * content words with function words.
 */
export const VIETNAMESE_STOP_WORDS: ReadonlySet<string> = new Set([
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
  "khi",
  "như",
  "vẫn",
  "đều",
  "chỉ",
  "ai",
  "gì",
  "nào",
  "đây",
  "kia",
  "ấy",
  "tôi",
  "bạn",
  "nó",
  "họ",
  "ta",
  "mình",
]);

/** Input for {@link validateEmphasis}. */
export interface EmphasisInput {
  defVi: string;
  leadVi?: string;
  emphasisVi: readonly string[];
}

/** Validation outcome: the emphasis phrases to keep plus human-readable warnings. */
export interface EmphasisResult {
  emphasis: string[];
  warnings: string[];
}

/**
 * Comparison key for one Vietnamese token: NFC-unified, lowercased, and
 * reduced to letters/digits. Diacritics are intentionally preserved.
 *
 * @param token - raw token, possibly with punctuation
 * @returns key such as "lặng" or "học"
 */
export function emphasisTokenKey(token: string): string {
  return token
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

/**
 * True when a token is a Vietnamese function word.
 * @param token - raw token
 */
export function isVietnameseStopWord(token: string): boolean {
  return VIETNAMESE_STOP_WORDS.has(emphasisTokenKey(token));
}

/**
 * Count the syllables of a phrase (Vietnamese syllables are space-separated).
 * @param phrase - candidate emphasis
 * @returns number of letter/digit tokens
 */
export function countSyllables(phrase: string): number {
  return phrase.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
}

/** Escape a value for use in a regular expression. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Longest (and casing-correct) occurrence of a phrase inside the source texts. */
function findOccurrence(
  haystacks: readonly string[],
  phrase: string,
): { text: string; start: number; end: number; haystack: string } | null {
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(phrase)}(?![\\p{L}\\p{N}])`, "iu");
  for (const haystack of haystacks) {
    const match = pattern.exec(haystack);
    if (match !== null && match.index !== undefined) {
      return {
        text: match[0],
        start: match.index,
        end: match.index + match[0].length,
        haystack,
      };
    }
  }
  return null;
}

/** Neighbouring token plus the characters joining it to the matched phrase. */
function neighbourToken(
  haystack: string,
  match: { start: number; end: number },
  direction: "left" | "right",
): { token: string; junction: string } | null {
  if (direction === "left") {
    const prefix = haystack.slice(0, match.start);
    const found = /([\p{L}\p{N}]+)([^\p{L}\p{N}]*)$/u.exec(prefix);
    if (found === null) return null;
    return { token: found[1], junction: found[2] };
  }
  const suffix = haystack.slice(match.end);
  const found = /^([^\p{L}\p{N}]*)([\p{L}\p{N}]+)/u.exec(suffix);
  if (found === null) return null;
  return { token: found[2], junction: found[1] };
}

/** A neighbour can only form a compound word when nothing but whitespace separates them. */
function isTightJunction(junction: string): boolean {
  return /^\s*$/u.test(junction);
}

/** Content syllable: at least two letters and not a function word. */
function isContentSyllable(token: string): boolean {
  const key = emphasisTokenKey(token);
  return key.length >= 2 && !VIETNAMESE_STOP_WORDS.has(key);
}

/**
 * Validate one candidate phrase.
 *
 * @param candidate - phrase proposed by the annotator
 * @param haystacks - NFC-normalized `defVi` and `leadVi`
 * @returns the phrase to keep (canonical casing) plus warnings; `phrase: null` means drop it
 */
function validateCandidate(
  candidate: string,
  haystacks: readonly string[],
): { phrase: string | null; warnings: string[] } {
  const warnings: string[] = [];
  const phrase = candidate.normalize("NFC").trim().replace(/\s+/gu, " ");
  if (phrase.length === 0) return { phrase: null, warnings };

  const occurrence = findOccurrence(haystacks, phrase);
  if (occurrence === null) {
    warnings.push(
      `emphasisVi: dropped "${phrase}" — it does not appear character-for-character in defVi or leadVi`,
    );
    return { phrase: null, warnings };
  }
  if (occurrence.text !== phrase) {
    warnings.push(`emphasisVi: "${phrase}" re-cased to "${occurrence.text}" as written in the source text`);
  }

  const syllables = countSyllables(phrase);
  const tokens = phrase.match(/[\p{L}\p{N}]+/gu) ?? [];

  if (tokens.every((token) => VIETNAMESE_STOP_WORDS.has(emphasisTokenKey(token)))) {
    warnings.push(`emphasisVi: dropped "${phrase}" — it is only function words`);
    return { phrase: null, warnings };
  }

  if (syllables === 1) {
    const neighbours: string[] = [];
    const left = neighbourToken(occurrence.haystack, occurrence, "left");
    if (left !== null && isTightJunction(left.junction) && isContentSyllable(left.token)) {
      neighbours.push(`${left.token} ${occurrence.text}`);
    }
    const right = neighbourToken(occurrence.haystack, occurrence, "right");
    if (right !== null && isTightJunction(right.junction) && isContentSyllable(right.token)) {
      neighbours.push(`${occurrence.text} ${right.token}`);
    }
    if (neighbours.length > 0) {
      warnings.push(
        `emphasisVi: dropped single syllable "${occurrence.text}" — it is probably half of "${neighbours[0]}"`,
      );
      return { phrase: null, warnings };
    }
    warnings.push(
      `emphasisVi: kept single syllable "${occurrence.text}" — no neighbouring content syllable, but multi-syllable phrases are safer`,
    );
    return { phrase: occurrence.text, warnings };
  }

  return { phrase: occurrence.text, warnings };
}

/** Where a kept phrase sits in the Vietnamese source text. */
interface KeptPhrase {
  phrase: string;
  haystack: string;
  start: number;
  end: number;
}

/**
 * Validate every emphasis candidate for one word.
 *
 * Overlapping candidates describe the same glow slot, so only the longer run
 * survives — the model answers both "Khoảng thời gian" and "thời gian", and the
 * feed can highlight one phrase per field at most.
 *
 * @param input - Vietnamese texts plus the proposed emphasis phrases
 * @returns deduplicated phrases (source casing) and the warnings explaining every change
 */
export function validateEmphasis(input: EmphasisInput): EmphasisResult {
  const haystacks = [input.defVi, input.leadVi ?? ""]
    .map((value) => value.normalize("NFC"))
    .filter((value) => value.trim().length > 0);

  const kept: KeptPhrase[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const candidate of input.emphasisVi) {
    const result = validateCandidate(candidate, haystacks);
    warnings.push(...result.warnings);
    if (result.phrase === null) continue;

    const key = result.phrase.toLowerCase();
    if (seen.has(key)) {
      warnings.push(`emphasisVi: dropped duplicate "${result.phrase}"`);
      continue;
    }
    seen.add(key);

    const placed = findOccurrence(haystacks, result.phrase);
    if (placed === null) continue;
    const current: KeptPhrase = {
      phrase: result.phrase,
      haystack: placed.haystack,
      start: placed.start,
      end: placed.end,
    };

    const clashIndex = kept.findIndex(
      (entry) => entry.haystack === current.haystack && entry.start < current.end && current.start < entry.end,
    );
    if (clashIndex !== -1) {
      const clash = kept[clashIndex];
      if (current.end - current.start > clash.end - clash.start) {
        warnings.push(
          `emphasisVi: "${current.phrase}" replaces the shorter overlapping "${clash.phrase}"`,
        );
        seen.delete(clash.phrase.toLowerCase());
        kept.splice(clashIndex, 1);
      } else {
        warnings.push(
          `emphasisVi: dropped "${current.phrase}" — it overlaps the longer "${clash.phrase}"`,
        );
        continue;
      }
    }
    kept.push(current);
  }

  return { emphasis: kept.map((entry) => entry.phrase), warnings };
}

/** Fields that may carry an inline `/phrase/` marker, in injection order. */
const MARKABLE_FIELDS = ["defVi", "leadVi"] as const;

/** Marker delimiter the app's `parseEmphasisMarkers` looks for. */
const MARKER_DELIMITER = "/";

/** Input for {@link injectEmphasisMarkers}. */
export interface MarkerInput {
  defVi: string;
  leadVi: string;
  emphasis: readonly string[];
}

/** Outcome of {@link injectEmphasisMarkers}: the text fields carrying markers. */
export interface MarkerResult {
  defVi: string;
  leadVi: string;
  /** Phrases that ended up marked, in field order. */
  marked: string[];
  warnings: string[];
}

/**
 * Strip every `/phrase/` marker and return the display text plus the phrases.
 * The inverse of {@link injectEmphasisMarkers}; unpaired slashes are left alone.
 *
 * @param text - field text, possibly carrying markers
 * @returns clean text and the phrases that were wrapped
 */
export function stripEmphasisMarkers(text: string): { clean: string; markers: string[] } {
  const markers: string[] = [];
  const clean = text.replace(/\/([^/]+)\//gu, (_match, phrase: string) => {
    markers.push(phrase.trim());
    return phrase.trim();
  });
  return { clean, markers };
}

/**
 * Wrap validated emphasis phrases in the field where they actually occur.
 *
 * One marker per field: the feed renders `leadVi` and `defVi` as separate pages
 * and highlights exactly one Vietnamese word per page, so a second marker in the
 * same field would be dead text. A phrase is placed in `defVi` first, then
 * `leadVi`. A phrase found in neither field is reported and left unmarked, and a
 * phrase whose every host field is already marked is reported too — the deck must
 * never carry a marker attached to text that lacks the phrase.
 *
 * @param input - the two Vietnamese fields plus the validated phrases
 * @returns fields with markers injected, the marked phrases, and warnings
 */
export function injectEmphasisMarkers(input: MarkerInput): MarkerResult {
  const warnings: string[] = [];
  const marked: string[] = [];
  const fields: Record<(typeof MARKABLE_FIELDS)[number], string> = {
    defVi: input.defVi,
    leadVi: input.leadVi,
  };

  for (const phrase of input.emphasis) {
    const candidate = phrase.normalize("NFC").trim().replace(/\s+/gu, " ");
    if (candidate.length === 0) continue;
    if (candidate.includes(MARKER_DELIMITER)) {
      warnings.push(`emphasis: skipped "${candidate}" because it contains a "/" delimiter`);
      continue;
    }

    const hosts = MARKABLE_FIELDS.filter((field) => occursIn(fields[field], candidate) !== null);
    if (hosts.length === 0) {
      warnings.push(`emphasis: left unmarked — "${candidate}" does not occur in defVi or leadVi`);
      continue;
    }
    // One marker per field, but a phrase shared by both fields may still move to
    // the field that is free.
    const hosted = hosts.find((field) => !fields[field].includes(MARKER_DELIMITER));
    if (hosted === undefined) {
      warnings.push(`emphasis: left unmarked — ${hosts.join(" and ")} already carries a marker ("${candidate}")`);
      continue;
    }

    const occurrence = occursIn(fields[hosted], candidate) as {
      text: string;
      start: number;
      end: number;
    };
    const source = fields[hosted];
    fields[hosted] =
      source.slice(0, occurrence.start) +
      MARKER_DELIMITER +
      occurrence.text +
      MARKER_DELIMITER +
      source.slice(occurrence.end);
    marked.push(occurrence.text);
  }

  return { defVi: fields.defVi, leadVi: fields.leadVi, marked, warnings };
}

/** First whole-token occurrence of a phrase in a field, keeping the field's casing. */
function occursIn(
  haystack: string,
  phrase: string,
): { text: string; start: number; end: number } | null {
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(phrase)}(?![\\p{L}\\p{N}])`, "iu");
  const match = pattern.exec(haystack);
  if (match === null || match.index === undefined) return null;
  return { text: match[0], start: match.index, end: match.index + match[0].length };
}
