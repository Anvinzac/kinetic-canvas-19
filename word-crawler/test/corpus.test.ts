/**
 * Corpus tests — bundled data integrity, deterministic ordering, dedupe,
 * level filters, resume filtering and the official-list importer.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  CorpusError,
  dedupeCorpus,
  filterByLevels,
  filterResume,
  loadBundledCorpus,
  normalizeCorpusWord,
  parseCorpus,
  parseLevelList,
  prepareCorpus,
  sortByFrequency,
  type CefrLevel,
  type CorpusWord,
} from "../src/corpus.ts";
import {
  bandForRank,
  importCorpusFromText,
  levelForBand,
  parseImportList,
} from "../src/corpus-import.ts";

/** Build a corpus word for synthetic fixtures. */
function corpusWord(
  word: string,
  level: CefrLevel,
  band: number,
  order: number,
  pos = "",
): CorpusWord {
  return { word, level, band, order, pos, source: "test" };
}

/** Words shipped in the mock deck that must never be duplicated by this corpus. */
const MOCK_DECK_WORDS = [
  "resilient",
  "vague",
  "negotiate",
  "deadline",
  "overlook",
  "reluctant",
  "genuine",
  "compromise",
  "subtle",
  "postpone",
  "reliable",
  "assume",
  "feedback",
  "anxious",
  "clarify",
  "priority",
  "hesitate",
  "accurate",
  "outcome",
  "persuade",
  "routine",
  "awkward",
  "benefit",
  "distract",
  "essential",
];

describe("bundled starter corpus", () => {
  test("loads, is attributed to CC BY-SA sources, and is a documented subset", () => {
    const corpus = loadBundledCorpus();
    assert.ok(corpus.words.length >= 300, `expected a meaningful subset, got ${corpus.words.length}`);
    assert.equal(corpus.meta.wordCount, corpus.words.length);
    assert.match(corpus.meta.license, /CC BY-SA 4\.0/);
    assert.match(corpus.meta.derivedFrom, /New General Service List/);
    assert.match(corpus.meta.derivedFrom, /New Academic Word List/);
    assert.match(corpus.meta.kind, /starter-subset/);

    const sourceIds = corpus.meta.sources.map((source) => source.id).sort();
    assert.deepEqual(sourceIds, ["nawl", "ngsl"]);
    for (const source of corpus.meta.sources) {
      assert.match(source.license, /CC BY-SA 4\.0/);
      assert.ok(source.authors.length > 0, `${source.id} needs an attribution line`);
      assert.ok(!/oxford/i.test(source.id), "Oxford lists are not acceptable for redistribution");
    }
  });

  test("every entry is a normalized single ASCII word with a valid level and band", () => {
    const corpus = loadBundledCorpus();
    assert.deepEqual(corpus.duplicates, []);
    for (const entry of corpus.words) {
      assert.match(entry.word, /^[a-z]+$/, `${entry.word} must be lowercase ASCII letters`);
      assert.ok(entry.band >= 1 && entry.band <= 4, `${entry.word} has band ${entry.band}`);
      assert.ok(!/oxford/i.test(entry.source), `${entry.word} must not come from Oxford data`);
    }
    // Levels follow the documented band heuristic: band 1 => A1/A2, 2 => B1, 3 => B2, 4 => C1.
    const expected: Record<number, CefrLevel[]> = {
      1: ["A1", "A2"],
      2: ["B1"],
      3: ["B2"],
      4: ["C1"],
    };
    for (const entry of corpus.words) {
      assert.ok(
        expected[entry.band].includes(entry.level),
        `${entry.word}: band ${entry.band} should map to ${expected[entry.band].join("/")}, got ${entry.level}`,
      );
    }
  });

  test("never repeats a word already shipped in the mock deck", () => {
    const words = new Set(loadBundledCorpus().words.map((entry) => entry.word));
    for (const mockWord of MOCK_DECK_WORDS) {
      assert.ok(!words.has(mockWord), `${mockWord} is already in the mock deck`);
    }
  });
});

describe("parseCorpus", () => {
  test("rejects entries that are not single ASCII words", () => {
    assert.throws(
      () => parseCorpus({ words: [{ word: "hello world", level: "A1" }] }, "fixture"),
      (error: unknown) =>
        error instanceof CorpusError && /hello world/.test((error as Error).message),
    );
  });

  test("reports the full list of invalid entries at once", () => {
    assert.throws(
      () => parseCorpus({ words: [{ word: "ok word", level: "A1" }, { word: "1st", level: "A1" }] }),
      (error: unknown) => {
        const message = (error as Error).message;
        return error instanceof CorpusError && message.includes("ok word") && message.includes("1st");
      },
    );
  });

  test("normalizes casing and whitespace and records duplicates without failing", () => {
    const corpus = parseCorpus({
      words: [
        { word: "  Water ", level: "A1" },
        { word: "water", level: "A1" },
        { word: "River", level: "A2" },
      ],
    });
    assert.deepEqual(
      corpus.words.map((entry) => entry.word),
      ["water", "water", "river"],
    );
    assert.equal(corpus.words[0].order, 0);
    assert.equal(corpus.words[2].order, 2);
    assert.deepEqual(corpus.duplicates, ["water (words.1 repeats words.0)"]);
    assert.equal(normalizeCorpusWord(" RIVER "), "river");
  });

  test("keeps unknown meta keys from import files", () => {
    const corpus = parseCorpus({ meta: { name: "x", custom: 42 }, words: [{ word: "rain", level: "A2" }] });
    assert.equal(corpus.meta.custom, 42);
  });
});

describe("deterministic ordering and dedupe", () => {
  test("sortByFrequency orders by band, then file order", () => {
    const sorted = sortByFrequency([
      corpusWord("zebra", "B1", 2, 3),
      corpusWord("apple", "A1", 1, 9),
      corpusWord("boat", "A1", 1, 2),
    ]);
    assert.deepEqual(
      sorted.map((entry) => entry.word),
      ["boat", "apple", "zebra"],
    );
  });

  test("dedupe keeps the entry from the lowest band and is stable across runs", () => {
    const words = [
      toRaw(corpusWord("focus", "B2", 3, 0)),
      toRaw(corpusWord("focus", "A2", 1, 1)),
      toRaw(corpusWord("river", "A2", 1, 2)),
    ];
    const resultA = prepareCorpus(parseCorpus({ words }));
    const resultB = prepareCorpus(parseCorpus({ words }));
    assert.deepEqual(resultA.words, resultB.words);
    assert.deepEqual(
      resultA.words.map((entry) => entry.word),
      ["focus", "river"],
    );
    assert.equal(resultA.words[0].level, "A2");
    assert.equal(resultA.duplicates.length, 1);
    assert.equal(resultA.duplicates[0].level, "B2");
  });

  test("dedupeCorpus leaves the input untouched", () => {
    const input = [corpusWord("rain", "A1", 1, 0), corpusWord("rain", "A1", 1, 1)];
    const result = dedupeCorpus(input);
    assert.equal(input.length, 2);
    assert.equal(result.words.length, 1);
  });
});

describe("filters", () => {
  const words = [
    corpusWord("apple", "A1", 1, 0),
    corpusWord("river", "A2", 1, 1),
    corpusWord("focus", "B1", 2, 2),
  ];

  test("filterByLevels keeps only requested levels and keeps order", () => {
    assert.deepEqual(
      filterByLevels(words, ["A2", "B1"]).map((entry) => entry.word),
      ["river", "focus"],
    );
    assert.equal(filterByLevels(words, []).length, 3);
  });

  test("filterResume matches case-insensitively and never mutates input", () => {
    const remaining = filterResume(words, [" APPLE ", "Focus"]);
    assert.deepEqual(remaining.map((entry) => entry.word), ["river"]);
    assert.equal(words.length, 3);
  });

  test("parseLevelList validates and orders levels", () => {
    assert.deepEqual(parseLevelList("b2, a1"), ["A1", "B2"]);
    assert.throws(() => parseLevelList("A1,D1"), CorpusError);
    assert.throws(() => parseLevelList(" , "), CorpusError);
  });
});

/** Convert a synthetic CorpusWord back to raw corpus JSON for parseCorpus. */
function toRaw(entry: CorpusWord): Record<string, unknown> {
  return { word: entry.word, level: entry.level, band: entry.band, pos: entry.pos, source: entry.source };
}

describe("official list importer", () => {
  const csv = [
    "rank,word",
    "1,water",
    "2,water",
    "3,something",
    "4,multi word",
    "",
    "# comment line",
    "5,river",
  ].join("\n");

  test("parseImportList skips the header, collapses duplicates and counts skips", () => {
    const { rows, summary } = parseImportList(csv);
    assert.deepEqual(
      rows.map((row) => row.word),
      ["water", "something", "river"],
    );
    assert.equal(rows[0].rank, 1);
    assert.equal(summary.duplicatesDropped, 1);
    assert.equal(summary.rowsSkipped, 2, "the rank,word header and the multi-word row are skipped");
  });

  test("band and level mapping follow the documented heuristic", () => {
    assert.equal(bandForRank(1), 1);
    assert.equal(bandForRank(1000), 1);
    assert.equal(bandForRank(1001), 2);
    assert.equal(bandForRank(2000), 2);
    assert.equal(bandForRank(2001), 3);
    assert.equal(bandForRank(null), 3);
    assert.equal(levelForBand(1), "A2");
    assert.equal(levelForBand(3), "B2");
  });

  test("importCorpusFromText demands attribution and emits a loadable corpus", () => {
    assert.throws(
      () => importCorpusFromText(csv, { name: "x", source: "ngsl", license: "", licenseUrl: "", attribution: "" }),
      /attribution/,
    );

    const { corpus, summary } = importCorpusFromText(csv, {
      name: "NGSL 1.2 (test import)",
      source: "ngsl",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      attribution: "Browne, C., Culligan, B., & Phillips, J. (2013). The New General Service List.",
      url: "https://www.newgeneralservicelist.com",
    });
    assert.equal(summary.wordsKept, 3);
    const loaded = parseCorpus(corpus, "import");
    assert.equal(loaded.words.length, 3);
    assert.equal(loaded.meta.sources.length, 1);
    assert.match(loaded.meta.sources[0].license, /CC BY-SA 4\.0/);
    assert.equal(loaded.words[0].level, "A2");
  });

  test("--level override applies one level to every imported word", () => {
    const { corpus } = importCorpusFromText("1,water\n2,river", {
      name: "forced",
      source: "nawl",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      attribution: "Browne, C., Culligan, B., & Phillips, J. (2013). The New Academic Word List.",
      level: "C1",
    });
    const loaded = parseCorpus(corpus, "import");
    assert.deepEqual(loaded.words.map((entry) => entry.level), ["C1", "C1"]);
  });
});
