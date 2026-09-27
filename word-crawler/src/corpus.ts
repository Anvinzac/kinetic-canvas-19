/**
 * Corpus module — the crawler's word source.
 *
 * Responsibility: load a corpus JSON file (bundled starter subset or an
 * imported official list), normalize it, and provide the deterministic
 * operations the crawler needs: frequency sorting, dedupe, CEFR level
 * filtering and resume filtering.
 *
 * Exports: CEFR_LEVELS, CefrLevel, CorpusWord, Corpus, CorpusError,
 *          parseCorpus, loadCorpusFile, loadBundledCorpus, prepareCorpus,
 *          sortByFrequency, dedupeCorpus, filterByLevels, filterResume,
 *          parseLevelList, normalizeCorpusWord, DEFAULT_CORPUS_PATH
 * Depends on: node:fs, node:url, zod
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";

/** CEFR levels in learning order. Corpus levels are assigned by data, never by the LLM. */
export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

/** One CEFR level. */
export type CefrLevel = (typeof CEFR_LEVELS)[number];

/** Where the bundled starter corpus lives, resolved relative to this module. */
export const DEFAULT_CORPUS_PATH = fileURLToPath(
  new URL("../data/ngsl-starter-subset.json", import.meta.url),
);

/**
 * One corpus entry after loading and normalization.
 *
 * @property word     NFC-normalized, lowercase, ASCII letters only (matches the
 *                    downstream deck contract `<word>` pattern).
 * @property level    CEFR level assigned by the corpus data (never the LLM).
 * @property pos      Optional part-of-speech hint passed to the annotator.
 * @property band     Coarse frequency tier, 1 = most frequent. The bundled file
 *                    documents what each band means for its sources.
 * @property source   Source list id: "ngsl", "nawl", or an id chosen at import.
 * @property order    Position inside the source file — the deterministic
 *                    tie-breaker inside one band.
 */
export interface CorpusWord {
  word: string;
  level: CefrLevel;
  pos: string;
  band: number;
  source: string;
  order: number;
}

/** Provenance record for one upstream word list. */
export interface CorpusSource {
  id: string;
  name: string;
  authors: string;
  url: string;
  license: string;
  licenseUrl: string;
  note: string;
}

/** Informational corpus header. Unknown keys from import files are preserved. */
export interface CorpusMeta {
  name: string;
  version: string;
  kind: string;
  locale: string;
  license: string;
  licenseUrl: string;
  derivedFrom: string;
  disclaimer: string;
  sources: CorpusSource[];
  [key: string]: unknown;
}

/** A loaded corpus file: provenance metadata plus normalized words. */
export interface Corpus {
  /** Absolute path the corpus was read from (empty for in-memory corpora). */
  path: string;
  meta: CorpusMeta;
  words: CorpusWord[];
  /**
   * Informational list of repeated words found while loading. Repeats are not
   * an error because dedupe is a documented, deterministic corpus feature;
   * the actual removal happens in {@link dedupeCorpus}.
   */
  duplicates: string[];
}

/** Raised for unreadable or invalid corpus files with a human-readable list of problems. */
export class CorpusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CorpusError";
  }
}

const levelSchema = z.enum(CEFR_LEVELS);

const sourceSchema = z
  .object({
    id: z.string().trim().min(1).max(40),
    name: z.string().trim().max(160).optional().default(""),
    authors: z.string().trim().max(240).optional().default(""),
    url: z.string().trim().max(240).optional().default(""),
    license: z.string().trim().max(120).optional().default(""),
    licenseUrl: z.string().trim().max(240).optional().default(""),
    note: z.string().trim().max(600).optional().default(""),
  })
  .passthrough();

const metaSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional().default("WordCrawler corpus"),
    version: z.string().trim().max(40).optional().default(""),
    kind: z.string().trim().max(40).optional().default(""),
    locale: z.string().trim().max(10).optional().default("en"),
    license: z.string().trim().max(120).optional().default(""),
    licenseUrl: z.string().trim().max(240).optional().default(""),
    derivedFrom: z.string().trim().max(1200).optional().default(""),
    disclaimer: z.string().trim().max(2000).optional().default(""),
    sources: z.array(sourceSchema).optional().default([]),
  })
  .passthrough();

const rawWordSchema = z.object({
  word: z.string().trim().min(2).max(64),
  level: levelSchema,
  pos: z.string().trim().max(20).optional().default(""),
  band: z.number().int().min(1).max(9).optional().default(1),
  source: z.string().trim().max(40).optional().default("unknown"),
});

const corpusFileSchema = z.object({
  meta: metaSchema.optional().default({}),
  words: z.array(rawWordSchema).min(1, "A corpus needs at least one word"),
});

/** Deck-compatible surface form: ASCII letters, lowercase, optional ' or -. */
const CORPUS_WORD_PATTERN = /^[a-z]+(?:['’-][a-z]+)*$/;

/**
 * Normalize a raw corpus token into the canonical comparison form.
 * NFC keeps Vietnamese/Latin accents intact while unifying encoding variants;
 * lowercasing makes resume matching and dedupe case-insensitive.
 *
 * @param raw - word as written in the source file
 * @returns canonical form ("École " -> "école")
 */
export function normalizeCorpusWord(raw: string): string {
  return raw.normalize("NFC").trim().toLowerCase();
}

/**
 * Validate and normalize an untrusted corpus object.
 * Collects every problem instead of failing on the first one so a broken
 * import can be fixed in one pass.
 *
 * @param input - parsed JSON of a corpus file
 * @param origin - path or label used in error messages
 * @returns normalized corpus (words carry their file position as `order`)
 * @throws CorpusError when the shape or any word is invalid
 */
export function parseCorpus(input: unknown, origin = "<memory>"): Corpus {
  const parsed = corpusFileSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "corpus"}: ${issue.message}`)
      .join("\n");
    throw new CorpusError(`Invalid corpus in ${origin}:\n${issues}`);
  }

  const invalid: string[] = [];
  const duplicates: string[] = [];
  const seen = new Map<string, number>();
  const words: CorpusWord[] = [];

  parsed.data.words.forEach((entry, index) => {
    const word = normalizeCorpusWord(entry.word);
    if (!CORPUS_WORD_PATTERN.test(word)) {
      invalid.push(
        `words.${index}.word: "${entry.word}" is not a single ASCII word (letters, optional ' or -)`,
      );
      return;
    }
    const previous = seen.get(word);
    if (previous === undefined) {
      seen.set(word, index);
    } else {
      duplicates.push(`${word} (words.${index} repeats words.${previous})`);
    }
    words.push({
      word,
      level: entry.level,
      pos: entry.pos,
      band: entry.band,
      source: entry.source,
      order: index,
    });
  });

  if (invalid.length > 0) {
    throw new CorpusError(`Invalid corpus in ${origin}:\n${invalid.join("\n")}`);
  }

  const meta = parsed.data.meta as CorpusMeta;
  return { path: origin, meta, words, duplicates };
}

/**
 * Read and validate a corpus JSON file from disk.
 * @param path - absolute or relative path to a corpus file
 * @returns normalized corpus
 * @throws CorpusError when the file is missing, not JSON, or invalid
 */
export function loadCorpusFile(path: string): Corpus {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new CorpusError(`Cannot read corpus file ${path}: ${reason}`);
  }
  try {
    return parseCorpus(JSON.parse(text) as unknown, path);
  } catch (error) {
    if (error instanceof CorpusError) throw error;
    throw new CorpusError(`Corpus file ${path} is not valid JSON`);
  }
}

/** Load the corpus shipped inside this package (`data/ngsl-starter-subset.json`). */
export function loadBundledCorpus(): Corpus {
  return loadCorpusFile(DEFAULT_CORPUS_PATH);
}

/**
 * Deterministic frequency order: band first, then the curated order inside the
 * band, then the alphabetical word. It never depends on object identity or
 * insertion order, so two runs over the same file always crawl the same order.
 *
 * @param words - corpus words
 * @returns a new sorted array
 */
export function sortByFrequency(words: readonly CorpusWord[]): CorpusWord[] {
  return [...words].sort(
    (left, right) =>
      left.band - right.band ||
      left.order - right.order ||
      left.word.localeCompare(right.word, "en"),
  );
}

/**
 * Remove duplicate words, keeping the first occurrence in frequency order.
 * Because the sort is stable and band-ordered, the surviving entry is always
 * the simplest (lowest band) definition of that word.
 *
 * @param words - corpus words (any order)
 * @returns kept words plus the dropped duplicates, both in frequency order
 */
export function dedupeCorpus(words: readonly CorpusWord[]): {
  words: CorpusWord[];
  duplicates: CorpusWord[];
} {
  const ordered = sortByFrequency(words);
  const kept: CorpusWord[] = [];
  const duplicates: CorpusWord[] = [];
  const seen = new Set<string>();
  for (const entry of ordered) {
    if (seen.has(entry.word)) {
      duplicates.push(entry);
      continue;
    }
    seen.add(entry.word);
    kept.push(entry);
  }
  return { words: kept, duplicates };
}

/** Prepare a loaded corpus for crawling: frequency-sorted and deduped. */
export function prepareCorpus(corpus: Corpus): {
  words: CorpusWord[];
  duplicates: CorpusWord[];
} {
  return dedupeCorpus(corpus.words);
}

/**
 * Keep only words whose CEFR level is in `levels`.
 * @param words - corpus words
 * @param levels - levels to keep; empty array means "keep everything"
 * @returns filtered words in their original order
 */
export function filterByLevels(
  words: readonly CorpusWord[],
  levels: readonly CefrLevel[],
): CorpusWord[] {
  if (levels.length === 0) return [...words];
  const wanted = new Set<string>(levels);
  return words.filter((entry) => wanted.has(entry.level));
}

/**
 * Drop words that are already annotated, so `--resume` never pays for a word twice.
 * Matching is on the normalized surface form, so "Time" and "time" are the same word.
 *
 * @param words - candidate words
 * @param knownWords - words already present in a deck or checkpoint
 * @returns only the words that still need annotation, order preserved
 */
export function filterResume(
  words: readonly CorpusWord[],
  knownWords: Iterable<string>,
): CorpusWord[] {
  const known = new Set<string>();
  for (const word of knownWords) known.add(normalizeCorpusWord(word));
  return words.filter((entry) => !known.has(entry.word));
}

/**
 * Parse a CLI level list such as "A1,A2" into validated CEFR levels.
 *
 * @param value - raw `--levels` argument
 * @returns unique levels in CEFR order
 * @throws CorpusError when a value is not a CEFR level
 */
export function parseLevelList(value: string): CefrLevel[] {
  const parts = value
    .split(",")
    .map((part) => part.trim().toUpperCase())
    .filter((part) => part.length > 0);
  if (parts.length === 0) throw new CorpusError("--levels needs at least one level, e.g. A1,A2");
  const unknown = parts.filter((part) => !CEFR_LEVELS.includes(part as CefrLevel));
  if (unknown.length > 0) {
    throw new CorpusError(
      `Unknown CEFR level(s): ${unknown.join(", ")}. Valid: ${CEFR_LEVELS.join(", ")}`,
    );
  }
  const wanted = new Set<string>(parts);
  return CEFR_LEVELS.filter((level) => wanted.has(level));
}
