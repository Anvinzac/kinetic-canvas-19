/**
 * Corpus importer — turn an official word-list download into a crawlable corpus file.
 *
 * Responsibility: parse a CSV/TSV export of an openly licensed list (for
 * example the official NGSL 1.2 "with basic statistics" download from
 * https://www.newgeneralservicelist.com), assign coarse frequency bands, map
 * bands to CEFR levels, and emit corpus JSON in this package's format.
 *
 * The importer is the supported route to a full-size corpus: data volume is a
 * file, never a code change. Download the official file yourself (the license
 * requires attribution, so the importer insists on attribution text).
 *
 * Exports: ImportedRow, ImportOptions, ImportSummary, parseImportText,
 *          bandForRank, levelForBand, importCorpusFromText, DEFAULT_LEVEL_BY_BAND
 * Depends on: ./corpus.ts
 */
import { normalizeCorpusWord, type CefrLevel } from "./corpus.ts";

/** One usable row of an imported list. */
export interface ImportedRow {
  word: string;
  rank: number | null;
}

/** Caller-supplied provenance; every license field is copied verbatim into the corpus meta. */
export interface ImportOptions {
  /** Corpus name, e.g. "NGSL 1.2 (full, imported)". */
  name: string;
  /** Source id used on every word, e.g. "ngsl". */
  source: string;
  /** Human-readable license name. Required: these lists are CC BY-SA 4.0. */
  license: string;
  /** License URL, normally https://creativecommons.org/licenses/by-sa/4.0/. */
  licenseUrl: string;
  /** Attribution line reproduced in the corpus meta and NOTICE.md. */
  attribution: string;
  /** Optional upstream URL. */
  url?: string;
  /** Force one CEFR level for every word instead of the band mapping. */
  level?: CefrLevel;
}

/** Counts describing what an import parsed and skipped. */
export interface ImportSummary {
  rowsRead: number;
  wordsKept: number;
  rowsSkipped: number;
  duplicatesDropped: number;
}

/**
 * Default band → CEFR mapping. Bands are the coarse frequency tiers this
 * package uses (1 = NGSL ranks 1-1000, 2 = 1001-2000, 3 = 2001+).
 * The mapping is a documented product heuristic, not an official NGSL claim:
 * an official list does not tag individual words with CEFR levels.
 */
export const DEFAULT_LEVEL_BY_BAND: Record<number, CefrLevel> = {
  1: "A2",
  2: "B1",
  3: "B2",
};

/**
 * Map an official frequency rank to this package's band.
 * @param rank - 1-based frequency rank from the source list
 * @returns band 1 (top 1000), 2 (1001-2000), or 3 (2001 and beyond)
 */
export function bandForRank(rank: number | null): number {
  if (rank === null || rank <= 0) return 3;
  if (rank <= 1000) return 1;
  if (rank <= 2000) return 2;
  return 3;
}

/**
 * Map a band to a CEFR level.
 * @param band - coarse frequency tier
 * @returns mapped level (band 3 for anything unmapped)
 */
export function levelForBand(band: number): CefrLevel {
  return DEFAULT_LEVEL_BY_BAND[band] ?? "B2";
}

/**
 * Parse a CSV/TSV word list into rows.
 *
 * The parser is deliberately forgiving because official files change layout:
 * every line is split on tab (or comma when no tab is present), the first cell
 * that looks like an English word becomes the headword, and the first numeric
 * cell becomes the rank. Column headers (rank, word, frequency, …), comments
 * and unrelated rows are skipped automatically.
 *
 * @param text - raw file contents
 * @returns usable rows, in file order, duplicates already collapsed by best rank
 */
export function parseImportText(text: string): ImportedRow[] {
  return parseImportList(text).rows;
}

/**
 * Column names that appear in official export headers ("Rank,Word,Frequency,…").
 * A row is treated as a header when it has at least two cells and every cell is
 * one of these names; the length guard keeps a bare word line such as "list"
 * usable in files that contain no ranks.
 */
const IMPORT_HEADER_CELLS = new Set([
  "rank",
  "word",
  "words",
  "wordlist",
  "list",
  "frequency",
  "freq",
  "dispersion",
  "pos",
  "lemma",
  "definition",
  "meaning",
  "translation",
  "no",
  "index",
  "order",
  "level",
  "cefr",
  "band",
  "count",
  "percent",
  "coverage",
  "statistics",
  "stat",
]);

/** True when every cell of a multi-cell row is a known column name. */
function isHeaderRow(cells: readonly string[]): boolean {
  const named = cells.filter((cell) => cell.length > 0);
  return named.length >= 2 && named.every((cell) => IMPORT_HEADER_CELLS.has(cell.toLowerCase()));
}

/**
 * Parse a CSV/TSV word list and report what was skipped.
 * Same rules as {@link parseImportText}, plus counts for the CLI report.
 *
 * @param text - raw file contents
 * @returns usable rows plus counts of skipped lines and collapsed duplicates
 */
export function parseImportList(text: string): { rows: ImportedRow[]; summary: ImportSummary } {
  const lines = text.split(/\r?\n/);
  const delimiter = text.includes("\t") ? "\t" : ",";
  const byWord = new Map<string, ImportedRow>();
  let rowsSkipped = 0;
  let duplicatesDropped = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;

    const cells = trimmed
      .split(delimiter)
      .map((cell) => cell.trim().replace(/^"(.*)"$/, "$1"));

    if (isHeaderRow(cells)) {
      rowsSkipped += 1; // e.g. "Rank,Word,Frequency,…" — a header, never a word entry
      continue;
    }

    const wordCell = cells.find((cell) => /^[A-Za-z][A-Za-z'’-]*$/.test(cell));
    if (wordCell === undefined) {
      rowsSkipped += 1; // header or unrelated row
      continue;
    }

    const word = normalizeCorpusWord(wordCell);
    if (word.length < 2) {
      rowsSkipped += 1; // single letters are not useful feed words
      continue;
    }

    const rankCell = cells.find((cell) => /^\d{1,7}$/.test(cell));
    const rank = rankCell === undefined ? null : Number(rankCell);

    const previous = byWord.get(word);
    if (previous === undefined) {
      byWord.set(word, { word, rank });
    } else {
      duplicatesDropped += 1;
      if (rank !== null && (previous.rank === null || rank < previous.rank)) {
        byWord.set(word, { word, rank });
      }
    }
  }

  const rows = [...byWord.values()];
  return {
    rows,
    summary: { rowsRead: rows.length, wordsKept: rows.length, rowsSkipped, duplicatesDropped },
  };
}

/**
 * Convert a CSV/TSV list into a corpus JSON object.
 *
 * @param text - raw file contents
 * @param options - provenance and level options
 * @returns corpus file content plus import counts
 */
export function importCorpusFromText(
  text: string,
  options: ImportOptions,
): { corpus: Record<string, unknown>; summary: ImportSummary } {
  if (options.license.trim().length === 0 || options.attribution.trim().length === 0) {
    throw new Error(
      "Import needs --license and --attribution: NGSL/NAWL are CC BY-SA 4.0 and require attribution.",
    );
  }

  const { rows, summary } = parseImportList(text);
  const words = rows.map((row) => {
    const band = bandForRank(row.rank);
    return {
      word: row.word,
      pos: "",
      level: options.level ?? levelForBand(band),
      band,
      source: options.source,
    };
  });

  const corpus = {
    meta: {
      name: options.name,
      version: "imported",
      kind: options.level ? "imported-official-list" : "imported-official-list-band-mapped",
      locale: "en",
      license: options.license,
      licenseUrl: options.licenseUrl,
      derivedFrom: options.attribution,
      disclaimer:
        "Imported from an official download. Bands are coarse frequency tiers and CEFR levels are this package's documented band heuristic" +
        (options.level ? ` (overridden to ${options.level} for this import).` : ", not an official claim by the list authors."),
      sources: [
        {
          id: options.source,
          name: options.name,
          authors: options.attribution,
          url: options.url ?? "",
          license: options.license,
          licenseUrl: options.licenseUrl,
          note: "Imported with word-crawler corpus:import. Keep this attribution with the data.",
        },
      ],
    },
    words,
  };

  return { corpus, summary: { ...summary, wordsKept: words.length } };
}
