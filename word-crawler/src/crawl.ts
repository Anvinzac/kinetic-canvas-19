/**
 * Crawl pipeline — corpus to deck, with resume, checkpoints and atomic output.
 *
 * Responsibility: orchestrate one crawl run:
 *   corpus -> level filter -> resume filter -> batches -> annotation ->
 *   emphasis validation -> checkpoint -> merged deck -> validation -> atomic write.
 *
 * Guarantees:
 * - The deck file is written atomically and only when the whole deck validates,
 *   so a crashed run never leaves partial or invalid JSON behind.
 * - Finished words are checkpointed after every batch; a later run with
 *   `--resume` (or the same `--output`) skips them instead of paying twice.
 * - Existing words from a resume deck are preserved and never reordered.
 *
 * Exports: CrawlOptions, CrawlReport, BatchAnnotator, CrawlDeps, chunkWords, runCrawl
 * Depends on: ./corpus.ts, ./emphasis.ts, ./deck.ts, ./checkpoint.ts,
 *             ./json-file.ts, ./annotate/transport.ts
 */
import { LlmRequestError, type BatchAnnotationResult } from "./annotate/transport.ts";
import { appendCheckpointWords, checkpointPathFor, readCheckpointWords } from "./checkpoint.ts";
import {
  filterByLevels,
  filterResume,
  loadBundledCorpus,
  loadCorpusFile,
  prepareCorpus,
  type CefrLevel,
  type CorpusWord,
} from "./corpus.ts";
import { buildDeck, buildDeckWord, toDeckWord, validateDeck, type DeckWord } from "./deck.ts";
import { validateEmphasis } from "./emphasis.ts";
import { readJsonFile, removeFileIfExists, writeJsonAtomic } from "./json-file.ts";

/** Everything one run needs. The CLI builds this from flags and environment. */
export interface CrawlOptions {
  /** Corpus file; defaults to the bundled starter subset. */
  corpusPath: string;
  /** CEFR levels to crawl; empty = all levels. */
  levels: CefrLevel[];
  /** Words per API request (1-50). */
  batchSize: number;
  /** Stop after this many words (useful for smoke runs). */
  limit?: number;
  /** Deck file to write, atomically. */
  outputPath: string;
  /** Existing deck whose words must be preserved and skipped. */
  resumePath?: string;
  /** Deck name written into meta. */
  deckName: string;
  /** Deck version written into meta. */
  deckVersion: string;
  /** Model name recorded in meta and used by the annotator. */
  model: string;
  /** Plan only: no API calls, no files touched. */
  dryRun: boolean;
}

/** Summary printed at the end of a run. */
export interface CrawlReport {
  dryRun: boolean;
  outputPath: string;
  corpusPath: string;
  corpusWords: number;
  duplicatesDropped: number;
  knownWords: number;
  plannedWords: number;
  batches: number;
  batchesFailed: number;
  annotatedWords: number;
  deckWords: number;
  missingWords: string[];
  warnings: string[];
  errors: string[];
  deckWritten: boolean;
}

/** The seam between the pipeline and the network: implement or mock this. */
export interface BatchAnnotator {
  annotateBatch(words: readonly CorpusWord[]): Promise<BatchAnnotationResult>;
}

/** Injectable collaborators; every one has a production default. */
export interface CrawlDeps {
  annotator?: BatchAnnotator;
  log?: (message: string) => void;
  now?: () => Date;
}

/**
 * Split items into fixed-size batches, preserving order.
 * @param items - items to split
 * @param size - batch size (at least 1)
 * @returns array of batches
 */
export function chunkWords<T>(items: readonly T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

/** Read the `words` array of an untrusted deck-like object. */
function wordsArrayOf(input: unknown): unknown[] | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return null;
  const words = (input as { words?: unknown }).words;
  return Array.isArray(words) ? words : null;
}

/**
 * Run one crawl.
 *
 * @param options - run configuration
 * @param deps - optional annotator, logger and clock (tests inject all three)
 * @returns the run report; the CLI maps `errors.length > 0` to a non-zero exit code
 */
export async function runCrawl(options: CrawlOptions, deps: CrawlDeps = {}): Promise<CrawlReport> {
  const log = deps.log ?? (() => {});
  const now = deps.now ?? (() => new Date());
  const warnings: string[] = [];
  const errors: string[] = [];
  const missingWords: string[] = [];

  // 1. Corpus: load, frequency-sort, dedupe, filter by requested levels.
  const corpus = options.corpusPath.length > 0 ? loadCorpusFile(options.corpusPath) : loadBundledCorpus();
  const prepared = prepareCorpus(corpus);
  const levelFiltered = filterByLevels(prepared.words, options.levels);

  // 2. Resume: existing deck words are the base of the new deck and are skipped.
  const baseWords: DeckWord[] = [];
  if (options.resumePath !== undefined) {
    const words = wordsArrayOf(readJsonFile(options.resumePath));
    if (words === null) throw new Error(`Resume file ${options.resumePath} has no words array`);
    words.forEach((entry, index) => {
      const deckWord = toDeckWord(entry);
      if (deckWord === null) {
        warnings.push(
          `${options.resumePath} words.${index}: not representable in the current deck contract; it will be crawled again`,
        );
        return;
      }
      baseWords.push(deckWord);
    });
    log(`resume: ${baseWords.length} existing words kept from ${options.resumePath}`);
  }

  // 3. Checkpoint from an earlier interrupted run against the same output path.
  const checkpointPath = checkpointPathFor(options.outputPath);
  const checkpoint = readCheckpointWords(checkpointPath);
  warnings.push(...checkpoint.warnings);
  if (checkpoint.words.length > 0) {
    log(`resume: ${checkpoint.words.length} words recovered from ${checkpointPath}`);
  }

  const known = new Set<string>([
    ...baseWords.map((word) => word.word),
    ...checkpoint.words.map((word) => word.word),
  ]);
  const pendingAll = filterResume(levelFiltered, known);
  const planned =
    options.limit === undefined ? pendingAll : pendingAll.slice(0, Math.max(0, options.limit));
  const batches = chunkWords(planned, options.batchSize);
  log(
    `corpus: ${prepared.words.length} words (${prepared.duplicates.length} duplicates dropped), ` +
      `${levelFiltered.length} after level filter, ${planned.length} to crawl in ${batches.length} batch(es)`,
  );

  // 4. Dry run stops here: the plan is the deliverable, nothing is written.
  if (options.dryRun) {
    for (const [index, batch] of batches.entries()) {
      log(`[dry-run] batch ${index + 1}/${batches.length}: ${batch.map((word) => word.word).join(", ")}`);
    }
    return {
      dryRun: true,
      outputPath: options.outputPath,
      corpusPath: corpus.path,
      corpusWords: prepared.words.length,
      duplicatesDropped: prepared.duplicates.length,
      knownWords: known.size,
      plannedWords: planned.length,
      batches: batches.length,
      batchesFailed: 0,
      annotatedWords: 0,
      deckWords: baseWords.length + checkpoint.words.length,
      missingWords,
      warnings,
      errors,
      deckWritten: false,
    };
  }

  if (deps.annotator === undefined) {
    throw new Error("runCrawl needs an annotator (deps.annotator) for a live run");
  }

  // 5. Crawl batch by batch, checkpointing each completed batch.
  const corpusByWord = new Map(planned.map((word) => [word.word, word]));
  const usedIds = new Set<string>([
    ...baseWords.map((word) => word.id),
    ...checkpoint.words.map((word) => word.id),
  ]);
  const completed: DeckWord[] = [];
  let batchesFailed = 0;

  for (const [index, batch] of batches.entries()) {
    try {
      const result = await deps.annotator.annotateBatch(batch);
      for (const issue of result.issues) {
        log(`note: ${issue}`);
        warnings.push(issue);
      }

      const finished: DeckWord[] = [];
      for (const annotation of result.annotations) {
        const corpusWord = corpusByWord.get(annotation.word);
        if (corpusWord === undefined) continue;

        const emphasis = validateEmphasis({
          defVi: annotation.defVi,
          leadVi: annotation.leadVi,
          emphasisVi: annotation.emphasisVi,
        });
        for (const warning of emphasis.warnings) {
          log(`note: ${annotation.word}: ${warning}`);
          warnings.push(`${annotation.word}: ${warning}`);
        }

        const built = buildDeckWord({
          corpusWord,
          annotation,
          emphasis: emphasis.emphasis,
          usedIds,
        });
        warnings.push(...built.warnings);
        errors.push(...built.errors);
        if (built.deckWord !== null) finished.push(built.deckWord);
      }

      if (finished.length > 0) {
        await appendCheckpointWords(checkpointPath, finished);
        completed.push(...finished);
      }
      missingWords.push(...result.missing);
      log(
        `[${index + 1}/${batches.length}] ${finished.length}/${batch.length} words annotated` +
          (result.usage === null ? "" : ` (${result.usage.inputTokens}/${result.usage.outputTokens} tokens)`),
      );
    } catch (error) {
      if (error instanceof LlmRequestError && error.fatal) {
        errors.push(`batch ${index + 1} aborted the crawl: ${error.message}`);
        log(`aborting: ${error.message}`);
        break;
      }
      batchesFailed += 1;
      const reason = error instanceof Error ? error.message : String(error);
      errors.push(`batch ${index + 1} failed: ${reason}`);
      log(`batch ${index + 1} failed, continuing with the next batch: ${reason}`);
    }
  }

  // 6. Merge base + checkpoint + this run, then validate before writing.
  const merged: DeckWord[] = [];
  const mergedWords = new Set<string>();
  for (const word of [...baseWords, ...checkpoint.words, ...completed]) {
    if (mergedWords.has(word.word)) continue;
    mergedWords.add(word.word);
    merged.push(word);
  }

  const deck = buildDeck({
    name: options.deckName,
    version: options.deckVersion,
    words: merged,
    extraMeta: {
      generator: "word-crawler",
      model: options.model,
      levels: options.levels.length > 0 ? options.levels : "all",
      generatedAt: now().toISOString(),
      corpus: {
        path: corpus.path,
        name: corpus.meta.name,
        version: corpus.meta.version,
        kind: corpus.meta.kind,
        license: corpus.meta.license,
        licenseUrl: corpus.meta.licenseUrl,
        derivedFrom: corpus.meta.derivedFrom,
        sources: corpus.meta.sources,
      },
    },
  });

  const validation = validateDeck(deck);
  warnings.push(...validation.warnings);
  let deckWritten = false;
  if (!validation.ok) {
    errors.push(
      `deck validation failed; nothing was written. First problem(s): ${validation.errors.slice(0, 10).join(" | ")}`,
    );
  } else {
    await writeJsonAtomic(options.outputPath, deck);
    deckWritten = true;
    await removeFileIfExists(checkpointPath);
    // The feed only glows from the inline markers; anything unmarked falls back
    // to heuristics, so coverage belongs in the run output, not just the file.
    const unmarked = validation.stats.words - validation.stats.withMarkers;
    log(
      `coverage: ${validation.stats.withMarkers}/${validation.stats.words} words carry an inline /emphasis/ marker` +
        (unmarked > 0 ? ` (${unmarked} will glow from heuristics only)` : ""),
    );
    log(`wrote ${merged.length} words to ${options.outputPath}`);
  }

  return {
    dryRun: false,
    outputPath: options.outputPath,
    corpusPath: corpus.path,
    corpusWords: prepared.words.length,
    duplicatesDropped: prepared.duplicates.length,
    knownWords: known.size,
    plannedWords: planned.length,
    batches: batches.length,
    batchesFailed,
    annotatedWords: completed.length,
    deckWords: merged.length,
    missingWords,
    warnings,
    errors,
    deckWritten,
  };
}
