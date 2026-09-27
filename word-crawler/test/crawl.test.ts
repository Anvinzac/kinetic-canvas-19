/**
 * Crawl pipeline tests — batching, dry runs, end-to-end runs with a fake
 * annotator (no network), resume, checkpoint recovery and failure handling.
 *
 * Temp directories are created inside the package (".test-tmp-*") and removed
 * after the suite, so the tests never touch the network or the real out/ dir.
 */
import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AnthropicRequestError } from "../src/annotate/anthropic.ts";
import type { CrawlerAnnotation } from "../src/annotate/contract.ts";
import { appendCheckpointWords, checkpointPathFor, readCheckpointWords } from "../src/checkpoint.ts";
import type { CefrLevel } from "../src/corpus.ts";
import { chunkWords, runCrawl, type BatchAnnotator, type CrawlOptions } from "../src/crawl.ts";
import { buildDeckWord, validateDeck, type Deck } from "../src/deck.ts";
import { readJsonFile } from "../src/json-file.ts";

/** Package root (word-crawler/), used to keep temp dirs inside the workspace. */
const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const createdDirs: string[] = [];

/** Create a unique temp directory inside the package. */
function makeTempDir(): string {
  const dir = mkdtempSync(join(PACKAGE_ROOT, ".test-tmp-"));
  createdDirs.push(dir);
  return dir;
}

after(() => {
  for (const dir of createdDirs) rmSync(dir, { recursive: true, force: true });
});

/** Write a minimal valid corpus file for a run. */
function writeCorpusFixture(dir: string, words: { word: string; level: CefrLevel }[]): string {
  const path = join(dir, "corpus.json");
  writeFileSync(
    path,
    JSON.stringify(
      {
        meta: {
          name: "Test corpus",
          version: "test",
          kind: "fixture",
          license: "CC BY-SA 4.0",
          licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
          derivedFrom: "test fixture",
          sources: [{ id: "test", authors: "test", license: "CC BY-SA 4.0" }],
        },
        words: words.map((entry) => ({
          word: entry.word,
          level: entry.level,
          band: 1,
          pos: "noun",
          source: "test",
        })),
      },
      null,
      2,
    ),
    "utf8",
  );
  return path;
}

/** A complete, contract-shaped annotation for one word. */
function makeAnnotationFor(word: string): CrawlerAnnotation {
  return {
    word,
    pos: "noun",
    ipa: "/test/",
    defVi: "Từ vựng tiếng Anh cho người học.",
    leadVi: "Gợi ý thuần Việt.",
    anticipateVi: "Gợi ý nghĩa tiếng Việt.",
    usageEn: "This is an example _____ sentence.",
    usageVi: "Đây là câu ví dụ.",
    topic: "general",
    emphasisVi: ["người học"],
  };
}

/** Fake annotator: records every batch it is asked for and can fail on demand. */
function makeFakeAnnotator(options: { failOn?: (batchIndex: number) => Error | null } = {}): {
  calls: string[][];
  annotator: BatchAnnotator;
} {
  const calls: string[][] = [];
  const annotator: BatchAnnotator = {
    async annotateBatch(words) {
      const index = calls.length;
      const names = words.map((word) => word.word);
      calls.push(names);
      const failure = options.failOn?.(index) ?? null;
      if (failure !== null) throw failure;
      return {
        requested: names,
        annotations: names.map((name) => makeAnnotationFor(name)),
        missing: [],
        issues: [],
        usage: { inputTokens: 10, outputTokens: 20 },
        stopReason: null,
      };
    },
  };
  return { calls, annotator };
}

/** Build the full CrawlOptions from overrides. */
function baseOptions(overrides: Partial<CrawlOptions>): CrawlOptions {
  return {
    corpusPath: "",
    levels: [],
    batchSize: 20,
    outputPath: "",
    deckName: "Test deck",
    deckVersion: "vtest",
    model: "test-model",
    dryRun: false,
    ...overrides,
  };
}

/** A corpus entry fixture for checkpoint tests. */
function corpusWordFixture(word: string): Parameters<typeof buildDeckWord>[0]["corpusWord"] {
  return { word, level: "A1", pos: "noun", band: 1, source: "test", order: 0 };
}

describe("chunkWords", () => {
  test("splits into fixed-size batches, preserving order", () => {
    assert.deepEqual(
      chunkWords([1, 2, 3, 4, 5, 6, 7], 3).map((batch) => batch.length),
      [3, 3, 1],
    );
    assert.deepEqual(chunkWords(["a"], 20), [["a"]]);
    assert.deepEqual(chunkWords([], 5), []);
  });
});

describe("runCrawl", () => {
  test("dry run plans batches without writing anything", async () => {
    const dir = makeTempDir();
    const corpusPath = writeCorpusFixture(dir, [
      { word: "apple", level: "A1" },
      { word: "river", level: "A1" },
      { word: "mountain", level: "A1" },
    ]);
    const outputPath = join(dir, "out", "deck.json");

    const report = await runCrawl(
      baseOptions({ corpusPath, levels: ["A1"], batchSize: 2, outputPath, dryRun: true }),
    );

    assert.equal(report.dryRun, true);
    assert.equal(report.deckWritten, false);
    assert.equal(report.knownWords, 0);
    assert.equal(report.plannedWords, 3);
    assert.equal(report.batches, 2);
    assert.equal(existsSync(outputPath), false);
    assert.equal(existsSync(checkpointPathFor(outputPath)), false);
  });

  test("annotates every word and writes a valid deck atomically", async () => {
    const dir = makeTempDir();
    const corpusPath = writeCorpusFixture(dir, [
      { word: "apple", level: "A1" },
      { word: "river", level: "A1" },
      { word: "mountain", level: "A1" },
    ]);
    const outputPath = join(dir, "out", "deck.json");
    const { calls, annotator } = makeFakeAnnotator();

    const report = await runCrawl(baseOptions({ corpusPath, batchSize: 2, outputPath }), {
      annotator,
      now: () => new Date("2026-01-02T03:04:05.000Z"),
    });

    assert.deepEqual(calls, [["apple", "river"], ["mountain"]]);
    assert.deepEqual(report.errors, []);
    assert.equal(report.deckWritten, true);
    assert.equal(report.annotatedWords, 3);
    assert.equal(report.deckWords, 3);
    assert.equal(existsSync(checkpointPathFor(outputPath)), false, "checkpoint is removed after a clean write");

    const deck = readJsonFile(outputPath) as Deck;
    assert.deepEqual(deck.words.map((word) => word.word), ["apple", "river", "mountain"]);
    assert.equal(deck.words[0].level, "A1");
    assert.deepEqual(deck.words[0].emphasis, ["người học"]);
    assert.equal(deck.meta.wordCount, 3);
    assert.equal(deck.meta.model, "test-model");
    assert.equal(deck.meta.generatedAt, "2026-01-02T03:04:05.000Z");
    assert.equal(deck.meta.levels, "all");
    assert.equal((deck.meta.corpus as { name: string }).name, "Test corpus");
    assert.ok(validateDeck(deck).ok);
  });

  test("honors the level filter", async () => {
    const dir = makeTempDir();
    const corpusPath = writeCorpusFixture(dir, [
      { word: "apple", level: "A1" },
      { word: "advanced", level: "B2" },
    ]);
    const outputPath = join(dir, "deck.json");
    const { calls, annotator } = makeFakeAnnotator();

    const report = await runCrawl(baseOptions({ corpusPath, levels: ["B2"], outputPath }), { annotator });

    assert.deepEqual(calls, [["advanced"]]);
    assert.equal(report.plannedWords, 1);
    const deck = readJsonFile(outputPath) as Deck;
    assert.deepEqual(deck.words.map((word) => word.word), ["advanced"]);
    assert.equal(deck.words[0].level, "B2");
    assert.deepEqual(deck.meta.levels, ["B2"]);
  });

  test("honors the limit", async () => {
    const dir = makeTempDir();
    const corpusPath = writeCorpusFixture(dir, [
      { word: "apple", level: "A1" },
      { word: "river", level: "A1" },
      { word: "mountain", level: "A1" },
      { word: "forest", level: "A1" },
    ]);
    const outputPath = join(dir, "deck.json");
    const { calls, annotator } = makeFakeAnnotator();

    const report = await runCrawl(baseOptions({ corpusPath, limit: 2, outputPath }), { annotator });

    assert.deepEqual(calls, [["apple", "river"]]);
    assert.equal(report.plannedWords, 2);
    assert.equal(report.deckWords, 2);
  });

  test("resume keeps existing words and only crawls the new ones", async () => {
    const dir = makeTempDir();
    const corpusPath = writeCorpusFixture(dir, [
      { word: "apple", level: "A1" },
      { word: "river", level: "A1" },
      { word: "mountain", level: "A1" },
    ]);
    const outputPath = join(dir, "deck.json");
    const first = makeFakeAnnotator();
    const firstReport = await runCrawl(baseOptions({ corpusPath, outputPath }), { annotator: first.annotator });
    assert.equal(firstReport.deckWritten, true);
    assert.equal(firstReport.knownWords, 0);

    const grownCorpus = writeCorpusFixture(dir, [
      { word: "apple", level: "A1" },
      { word: "river", level: "A1" },
      { word: "mountain", level: "A1" },
      { word: "zebra", level: "A1" },
    ]);
    const second = makeFakeAnnotator();
    const secondReport = await runCrawl(
      baseOptions({ corpusPath: grownCorpus, outputPath, resumePath: outputPath }),
      { annotator: second.annotator },
    );

    assert.deepEqual(second.calls, [["zebra"]]);
    assert.equal(secondReport.knownWords, 3);
    assert.deepEqual(secondReport.errors, []);

    const deck = readJsonFile(outputPath) as Deck;
    assert.deepEqual(deck.words.map((word) => word.word), ["apple", "river", "mountain", "zebra"]);
    assert.equal(deck.meta.wordCount, 4);
    assert.ok(validateDeck(deck).ok);
  });

  test("recovers finished words from a checkpoint and removes it after success", async () => {
    const dir = makeTempDir();
    const corpusPath = writeCorpusFixture(dir, [
      { word: "apple", level: "A1" },
      { word: "river", level: "A1" },
    ]);
    const outputPath = join(dir, "deck.json");

    const built = buildDeckWord({
      corpusWord: corpusWordFixture("apple"),
      annotation: makeAnnotationFor("apple"),
      emphasis: ["người học"],
      usedIds: new Set<string>(),
    });
    assert.ok(built.deckWord);
    await appendCheckpointWords(checkpointPathFor(outputPath), [built.deckWord]);

    const { calls, annotator } = makeFakeAnnotator();
    const report = await runCrawl(baseOptions({ corpusPath, outputPath }), { annotator });

    assert.deepEqual(calls, [["river"]]);
    assert.equal(report.knownWords, 1);
    assert.deepEqual(report.errors, []);
    assert.equal(existsSync(checkpointPathFor(outputPath)), false);

    const deck = readJsonFile(outputPath) as Deck;
    assert.deepEqual(deck.words.map((word) => word.word), ["apple", "river"]);
  });

  test("readCheckpointWords skips damaged lines and unusable entries", () => {
    const dir = makeTempDir();
    const checkpointPath = checkpointPathFor(join(dir, "deck.json"));
    const built = buildDeckWord({
      corpusWord: corpusWordFixture("apple"),
      annotation: makeAnnotationFor("apple"),
      emphasis: ["người học"],
      usedIds: new Set<string>(),
    });
    assert.ok(built.deckWord);
    writeFileSync(
      checkpointPath,
      `{"broken\n${JSON.stringify({ word: "nope" })}\n${JSON.stringify(built.deckWord)}\n`,
      "utf8",
    );

    const { words, warnings } = readCheckpointWords(checkpointPath);
    assert.deepEqual(words.map((word) => word.word), ["apple"]);
    assert.ok(warnings.some((warning) => /line 1: not valid JSON/.test(warning)));
    assert.ok(warnings.some((warning) => /line 2: not a usable deck word/.test(warning)));
  });

  test("a non-fatal batch failure continues and still writes the finished words", async () => {
    const dir = makeTempDir();
    const corpusPath = writeCorpusFixture(dir, [
      { word: "apple", level: "A1" },
      { word: "river", level: "A1" },
      { word: "mountain", level: "A1" },
      { word: "forest", level: "A1" },
    ]);
    const outputPath = join(dir, "deck.json");
    const { annotator } = makeFakeAnnotator({
      failOn: (index) => (index === 1 ? new Error("temporary glitch") : null),
    });

    const report = await runCrawl(baseOptions({ corpusPath, batchSize: 2, outputPath }), { annotator });

    assert.equal(report.batchesFailed, 1);
    assert.ok(report.errors.some((error) => /batch 2 failed/.test(error)));
    assert.equal(report.deckWritten, true);

    const deck = readJsonFile(outputPath) as Deck;
    assert.deepEqual(deck.words.map((word) => word.word), ["apple", "river"]);
  });

  test("a fatal error aborts the crawl and writes nothing", async () => {
    const dir = makeTempDir();
    const corpusPath = writeCorpusFixture(dir, [{ word: "apple", level: "A1" }]);
    const outputPath = join(dir, "deck.json");
    const { annotator } = makeFakeAnnotator({
      failOn: () => new AnthropicRequestError("invalid key", { status: 401, fatal: true }),
    });

    const report = await runCrawl(baseOptions({ corpusPath, outputPath }), { annotator });

    assert.equal(report.deckWritten, false);
    assert.ok(report.errors.some((error) => /aborted the crawl/.test(error)));
    assert.equal(existsSync(outputPath), false);
  });
});
