/**
 * Deck builder and validator — the crawler's output contract.
 *
 * Responsibility: turn validated annotations plus corpus levels into the
 * WordCrawler deck shape the main app imports (`meta` + `words`), and validate
 * a deck file against the same rules the app enforces (ids, word pattern,
 * duplicates, answer leaks, field lengths).
 *
 * The level shown in every deck word always comes from the corpus — never
 * from the model. Emphasis is written twice on purpose: as an inline
 * `/phrase/` marker inside the Vietnamese field it belongs to (the format the
 * feed's `parseEmphasisMarkers` reads) and as the `emphasis` array (the format
 * the content-hub deck reader sanitizes against).
 *
 * Exports: Deck, DeckMeta, DeckWord, DeckUsage, DECK_DISCOVER_PAGES,
 *          DECK_REVERSE_PAGES, slugifyWord, buildDeckWord, buildDeck,
 *          validateDeck, toDeckWord
 * Depends on: ./corpus.ts, ./emphasis.ts, ./annotate/contract.ts
 */
import type { CefrLevel, CorpusWord } from "./corpus.ts";
import { CEFR_LEVELS } from "./corpus.ts";
import { containsTargetWord, type CrawlerAnnotation } from "./annotate/contract.ts";
import { injectEmphasisMarkers, stripEmphasisMarkers } from "./emphasis.ts";

/** One English/Vietnamese example pair, exactly as the app imports it. */
export interface DeckUsage {
  en: string;
  vi: string;
}

/** One deck entry. `emphasis` is the crawler addition the feed renders as glow phrases. */
export interface DeckWord {
  id: string;
  word: string;
  pos: string;
  ipa: string;
  /** Vietnamese definition; may carry one inline `/phrase/` emphasis marker. */
  defVi: string;
  /** Vietnamese teaser; may carry one inline `/phrase/` emphasis marker. */
  leadVi: string;
  anticipateVi: string;
  topic: string;
  level: CefrLevel;
  chars: number;
  initial: string;
  usage: DeckUsage[];
  emphasis: string[];
}

/** Deck header, mirroring the existing WordCrawler files (unknown keys are preserved). */
export interface DeckMeta {
  name: string;
  purpose: string;
  locale: string;
  discoverPages: string[];
  reversePages: string[];
  wordCount: number;
  version: string;
  notes: string;
  [key: string]: unknown;
}

/** A complete deck file. */
export interface Deck {
  meta: DeckMeta;
  words: DeckWord[];
}

/** Page order the feed renders, copied from the existing WordCrawler decks. */
export const DECK_DISCOVER_PAGES = [
  "1_leadVi",
  "2_defVi",
  "3_chars",
  "4_usage",
  "5_initial",
  "6_anticipate",
  "7_reveal_en",
];

/** Reverse-mode page order, copied from the existing WordCrawler decks. */
export const DECK_REVERSE_PAGES = [
  "1_word_en",
  "2_defVi",
  "3_leadVi",
  "4_usage_highlighted",
];

/** Deck id pattern, identical to the app's importer rule. */
const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/** Headword pattern, identical to the app's importer rule. */
const WORD_PATTERN = /^[a-zA-Z]+(?:['’-][a-zA-Z]+)*$/;

/** Topic pattern, identical to the app's importer rule. */
const TOPIC_PATTERN = /^[a-z0-9-]*$/;

/**
 * Build the deck id for a word.
 * @param word - normalized English word
 * @returns lowercase slug made of letters, digits, dashes and underscores
 */
export function slugifyWord(word: string): string {
  const slug = word
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "word";
}

/**
 * Assemble one deck word from a corpus entry and its validated annotation.
 *
 * @param input.corpusWord - corpus entry (source of `level`)
 * @param input.annotation - validated crawler annotation
 * @param input.emphasis - emphasis phrases already passed through validateEmphasis
 * @param input.usedIds - ids already taken in this deck; the function records the new one
 * @returns the deck word plus warnings (or an error when the annotation is incomplete)
 */
export function buildDeckWord(input: {
  corpusWord: CorpusWord;
  annotation: CrawlerAnnotation | null;
  emphasis: readonly string[];
  usedIds: Set<string>;
}): { deckWord: DeckWord | null; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];
  const word = input.corpusWord.word;

  if (input.annotation === null) {
    return { deckWord: null, warnings, errors: [`${word}: no annotation to build from`] };
  }
  const annotation = input.annotation;
  if (annotation.defVi.trim().length < 2) {
    return { deckWord: null, warnings, errors: [`${word}: annotation has no usable defVi`] };
  }

  // Defense in depth: the contract parser already repairs this, but the deck
  // must never ship a Vietnamese teaser that contains the English answer.
  let anticipateVi = annotation.anticipateVi;
  if (containsTargetWord(anticipateVi, word)) {
    anticipateVi = "";
    warnings.push(`${word}: anticipateVi contained the answer and was emptied`);
  }

  let id = slugifyWord(word);
  if (input.usedIds.has(id)) {
    let suffix = 2;
    while (input.usedIds.has(`${id}-${suffix}`)) suffix += 1;
    warnings.push(`${word}: id "${id}" was taken; using "${id}-${suffix}"`);
    id = `${id}-${suffix}`;
  }
  input.usedIds.add(id);

  const usage: DeckUsage[] = [];
  if (annotation.usageEn.trim().length > 0) {
    usage.push({ en: annotation.usageEn, vi: annotation.usageVi });
  } else {
    warnings.push(`${word}: no usable example sentence; usage will be empty`);
  }

  // The feed highlights the phrases marked inside each field, so the validated
  // emphasis list is injected as inline `/phrase/` markers before writing.
  const markers = injectEmphasisMarkers({
    defVi: annotation.defVi,
    leadVi: annotation.leadVi,
    emphasis: input.emphasis,
  });
  warnings.push(...markers.warnings);

  const letters = word.match(/\p{L}/gu) ?? [];
  const deckWord: DeckWord = {
    id,
    word,
    pos: annotation.pos,
    ipa: annotation.ipa,
    defVi: markers.defVi,
    leadVi: markers.leadVi,
    anticipateVi,
    topic: annotation.topic.length > 0 ? annotation.topic : "general",
    level: input.corpusWord.level,
    chars: letters.length,
    initial: word.charAt(0).toUpperCase(),
    usage,
    emphasis: [...input.emphasis],
  };
  return { deckWord, warnings, errors };
}

/**
 * Assemble a deck file.
 *
 * @param input.name - deck name shown by the app importer
 * @param input.version - deck version string
 * @param input.notes - free-form note stored in meta
 * @param input.words - deck words in crawl order
 * @param input.extraMeta - provenance keys to merge into meta (corpus, license, model, date)
 * @returns deck object ready for {@link import("./json-file.ts").writeJsonAtomic}
 */
export function buildDeck(input: {
  name: string;
  version: string;
  notes?: string;
  words: readonly DeckWord[];
  extraMeta?: Record<string, unknown>;
}): Deck {
  return {
    meta: {
      name: input.name,
      purpose: "WordCrawler vocabulary deck generated by the word-crawler package",
      locale: "vi",
      discoverPages: [...DECK_DISCOVER_PAGES],
      reversePages: [...DECK_REVERSE_PAGES],
      wordCount: input.words.length,
      version: input.version,
      notes:
        input.notes ??
        "Page 6 (anticipate) is a pure-Vietnamese tease before the English reveal. Never include English words, slang, or the target word.",
      ...input.extraMeta,
    },
    words: [...input.words],
  };
}

/** Result of validating a deck file. */
export interface DeckValidationReport {
  ok: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    words: number;
    byLevel: Record<string, number>;
    topics: string[];
    withEmphasis: number;
    /** Words whose Vietnamese text carries at least one inline `/phrase/` marker. */
    withMarkers: number;
    withUsage: number;
    withIpa: number;
  };
}

/** Basic shape checks shared by validation and reading. */
function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Validate an untrusted deck object against the app's import rules plus the
 * crawler's own emphasis contract.
 *
 * Errors block the deck (the app's importer would throw); warnings are
 * quality notes the feed tolerates.
 *
 * @param input - parsed deck JSON
 * @returns report with errors, warnings and summary statistics
 */
export function validateDeck(input: unknown): DeckValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const byLevel: Record<string, number> = {};
  const topics = new Set<string>();
  let withEmphasis = 0;
  let withMarkers = 0;
  let withUsage = 0;
  let withIpa = 0;

  const root = asRecord(input);
  if (root === null) {
    return {
      ok: false,
      errors: ["deck must be a JSON object with meta and words"],
      warnings,
      stats: { words: 0, byLevel, topics: [], withEmphasis, withMarkers, withUsage, withIpa },
    };
  }
  if (asRecord(root.meta) === null) warnings.push("meta is missing or not an object");
  const words = root.words;
  if (!Array.isArray(words) || words.length === 0) {
    return {
      ok: false,
      errors: ["words must be a non-empty array"],
      warnings,
      stats: { words: 0, byLevel, topics: [], withEmphasis, withMarkers, withUsage, withIpa },
    };
  }

  const ids = new Set<string>();
  const seenWords = new Set<string>();

  words.forEach((rawWord, index) => {
    const entry = asRecord(rawWord);
    if (entry === null) {
      errors.push(`words.${index}: not an object`);
      return;
    }
    const where = `words.${index}`;
    const word = typeof entry.word === "string" ? entry.word.normalize("NFC").toLowerCase() : "";
    const id = typeof entry.id === "string" ? entry.id.toLowerCase() : "";

    if (!WORD_PATTERN.test(word) || word.length < 2 || word.length > 64) {
      errors.push(`${where}.word: "${String(entry.word)}" is not a valid headword`);
    }
    if (word.length > 0 && seenWords.has(word)) errors.push(`${where}.word: duplicate word "${word}"`);
    seenWords.add(word);

    if (!ID_PATTERN.test(id) || id.length === 0 || id.length > 80) {
      errors.push(`${where}.id: "${String(entry.id)}" is not a valid id`);
    }
    if (id.length > 0 && ids.has(id)) errors.push(`${where}.id: duplicate id "${id}"`);
    ids.add(id);

    const defViRaw = typeof entry.defVi === "string" ? entry.defVi.trim() : "";
    const leadViRaw = typeof entry.leadVi === "string" ? entry.leadVi.trim() : "";
    // Inline `/phrase/` markers are what the feed renders; a stray delimiter
    // would be shown to the user, so it fails the deck.
    const defViParts = stripEmphasisMarkers(defViRaw);
    const leadViParts = stripEmphasisMarkers(leadViRaw);
    for (const [field, parts] of [
      ["defVi", defViParts],
      ["leadVi", leadViParts],
    ] as const) {
      if (parts.clean.includes("/")) {
        errors.push(`${where}.${field}: unpaired "/" delimiter — emphasis markers must be /phrase/ pairs`);
      }
      for (const marker of parts.markers) {
        if (marker.trim().length === 0) errors.push(`${where}.${field}: empty / / emphasis marker`);
        else if (marker.length > 80) errors.push(`${where}.${field}: emphasis marker "${marker}" is too long`);
      }
      if (parts.markers.length > 1) {
        warnings.push(`${where}.${field}: ${parts.markers.length} emphasis markers; the feed highlights one per page`);
      }
    }
    if (defViParts.markers.length > 0 || leadViParts.markers.length > 0) withMarkers += 1;

    const defVi = defViParts.clean;
    const leadVi = leadViParts.clean;
    if (defVi.length < 2 || defVi.length > 400) {
      errors.push(`${where}.defVi: must be 2-400 characters`);
    }
    if (leadVi.length > 240) errors.push(`${where}.leadVi: must be at most 240 characters`);
    const anticipateVi = typeof entry.anticipateVi === "string" ? entry.anticipateVi.trim() : "";
    if (anticipateVi.length > 180) {
      errors.push(`${where}.anticipateVi: must be at most 180 characters`);
    }
    if (word.length > 0 && containsTargetWord(anticipateVi, word)) {
      errors.push(`${where}.anticipateVi: contains the English answer`);
    }
    const pos = typeof entry.pos === "string" ? entry.pos.trim() : "";
    if (pos.length > 40) errors.push(`${where}.pos: must be at most 40 characters`);
    const ipa = typeof entry.ipa === "string" ? entry.ipa.trim() : "";
    if (ipa.length > 120) errors.push(`${where}.ipa: must be at most 120 characters`);
    if (ipa.length === 0) warnings.push(`${where}.ipa: empty`);
    else withIpa += 1;

    const topic = typeof entry.topic === "string" ? entry.topic.trim().toLowerCase() : "general";
    if (!TOPIC_PATTERN.test(topic) || topic.length > 60) {
      errors.push(`${where}.topic: "${String(entry.topic)}" is not a lowercase tag`);
    } else {
      topics.add(topic.length > 0 ? topic : "general");
    }

    const level = typeof entry.level === "string" ? entry.level : "";
    if (!CEFR_LEVELS.includes(level as CefrLevel)) {
      errors.push(`${where}.level: "${level}" is not a CEFR level`);
    } else {
      byLevel[level] = (byLevel[level] ?? 0) + 1;
    }

    const letters = (word.match(/\p{L}/gu) ?? []).length;
    if (typeof entry.chars === "number" && entry.chars !== letters) {
      errors.push(`${where}.chars: ${entry.chars} does not match the ${letters} letters in "${word}"`);
    }
    const expectedInitial = word.length > 0 ? word.charAt(0).toUpperCase() : "";
    if (typeof entry.initial === "string" && entry.initial !== expectedInitial) {
      errors.push(`${where}.initial: "${entry.initial}" should be "${expectedInitial}"`);
    }

    const usage = entry.usage;
    if (!Array.isArray(usage) || usage.length > 5) {
      errors.push(`${where}.usage: must be an array of at most 5 example sentences`);
    } else if (usage.length === 0) {
      warnings.push(`${where}.usage: empty`);
    } else {
      withUsage += 1;
      usage.forEach((rawUsage, usageIndex) => {
        const pair = asRecord(rawUsage);
        const en = typeof pair?.en === "string" ? pair.en.trim() : "";
        if (en.length === 0 || en.length > 400) {
          errors.push(`${where}.usage.${usageIndex}.en: must be 1-400 characters`);
        }
      });
    }

    const emphasis = entry.emphasis;
    if (emphasis !== undefined) {
      if (!Array.isArray(emphasis)) {
        errors.push(`${where}.emphasis: must be an array of strings`);
      } else {
        const seenEmphasis = new Set<string>();
        for (const [emphasisIndex, candidate] of emphasis.entries()) {
          if (typeof candidate !== "string" || candidate.trim().length === 0) {
            errors.push(`${where}.emphasis.${emphasisIndex}: must be a non-empty string`);
            continue;
          }
          const key = candidate.normalize("NFC").trim().toLowerCase();
          if (seenEmphasis.has(key)) {
            errors.push(`${where}.emphasis.${emphasisIndex}: duplicate "${candidate}"`);
          }
          seenEmphasis.add(key);
          const haystack = `${defVi}\n${leadVi}`.toLowerCase();
          if (!haystack.includes(key)) {
            errors.push(`${where}.emphasis.${emphasisIndex}: "${candidate}" does not occur in defVi or leadVi`);
          }
        }
        if (emphasis.length > 0) withEmphasis += 1;
        // Every marker must be backed by the annotated list, otherwise the two
        // representations of the same decision have already drifted apart.
        for (const marker of [...defViParts.markers, ...leadViParts.markers]) {
          if (!seenEmphasis.has(marker.normalize("NFC").trim().toLowerCase())) {
            warnings.push(`${where}.emphasis: marker "${marker}" is missing from the emphasis array`);
          }
        }
      }
    } else {
      warnings.push(`${where}.emphasis: missing (older decks do not carry emphasis)`);
    }
  });

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      words: words.length,
      byLevel,
      topics: [...topics].sort(),
      withEmphasis,
      withMarkers,
      withUsage,
      withIpa,
    },
  };
}

/**
 * Normalize an arbitrary deck entry — this package's output, a checkpoint
 * line, or an older mock deck entry — into the current DeckWord shape.
 *
 * Used when resuming: base words are re-validated instead of trusted, and an
 * entry that cannot be represented in the current contract is reported (and
 * therefore crawled again) rather than silently dropped.
 *
 * @param input - untrusted deck entry
 * @returns normalized deck word, or null when the entry is unusable
 */
export function toDeckWord(input: unknown): DeckWord | null {
  const entry = asRecord(input);
  if (entry === null) return null;

  const word = typeof entry.word === "string" ? entry.word.normalize("NFC").trim().toLowerCase() : "";
  if (!WORD_PATTERN.test(word) || word.length < 2 || word.length > 64) return null;

  const defVi = typeof entry.defVi === "string" ? entry.defVi.trim() : "";
  if (defVi.length < 2 || defVi.length > 400) return null;

  const level = typeof entry.level === "string" ? entry.level : "";
  if (!CEFR_LEVELS.includes(level as CefrLevel)) return null;

  const id = typeof entry.id === "string" && ID_PATTERN.test(entry.id) ? entry.id.toLowerCase() : slugifyWord(word);

  const usage: DeckUsage[] = [];
  if (Array.isArray(entry.usage)) {
    for (const rawUsage of entry.usage.slice(0, 5)) {
      const pair = asRecord(rawUsage);
      const en = typeof pair?.en === "string" ? pair.en.trim() : "";
      if (en.length === 0 || en.length > 400) continue;
      usage.push({ en, vi: typeof pair?.vi === "string" ? pair.vi.trim() : "" });
    }
  }

  const emphasis: string[] = [];
  const seenEmphasis = new Set<string>();
  if (Array.isArray(entry.emphasis)) {
    for (const candidate of entry.emphasis) {
      if (typeof candidate !== "string") continue;
      const phrase = candidate.normalize("NFC").trim().replace(/\s+/gu, " ");
      if (phrase.length === 0) continue;
      const key = phrase.toLowerCase();
      if (seenEmphasis.has(key)) continue;
      seenEmphasis.add(key);
      emphasis.push(phrase);
    }
  }

  const letters = word.match(/\p{L}/gu) ?? [];
  const topic = typeof entry.topic === "string" ? entry.topic.trim().toLowerCase() : "general";
  return {
    id,
    word,
    pos: typeof entry.pos === "string" ? entry.pos.trim() : "",
    ipa: typeof entry.ipa === "string" ? entry.ipa.trim() : "",
    defVi,
    leadVi: typeof entry.leadVi === "string" ? entry.leadVi.trim() : "",
    anticipateVi: typeof entry.anticipateVi === "string" ? entry.anticipateVi.trim() : "",
    topic: TOPIC_PATTERN.test(topic) && topic.length > 0 ? topic : "general",
    level: level as CefrLevel,
    chars: letters.length,
    initial: word.charAt(0).toUpperCase(),
    usage,
    emphasis,
  };
}
