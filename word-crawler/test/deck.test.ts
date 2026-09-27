/**
 * Deck tests — deck word construction (level always from the corpus), deck
 * assembly, contract validation and resume normalization of old entries.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseAnnotation, type CrawlerAnnotation } from "../src/annotate/contract.ts";
import type { CefrLevel, CorpusWord } from "../src/corpus.ts";
import {
  DECK_DISCOVER_PAGES,
  DECK_REVERSE_PAGES,
  buildDeck,
  buildDeckWord,
  slugifyWord,
  toDeckWord,
  validateDeck,
  type DeckWord,
} from "../src/deck.ts";

/** A clean annotation item, the way the model should return it. */
function annotationItem(word: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    word,
    pos: "noun",
    ipa: "/ˈwɔːtər/",
    defVi: "Chất lỏng trong suốt mà ta uống mỗi ngày.",
    leadVi: "Nước là nguồn sống.",
    anticipateVi: "Thứ bạn uống khi khát.",
    usageEn: "Please drink more _____ before running.",
    usageVi: "Hãy uống thêm nước trước khi chạy.",
    topic: "health",
    emphasisVi: ["uống mỗi ngày"],
    ...overrides,
  };
}

/** Parse a fixture item into a real annotation (fails the test when it does not parse). */
function annotationFor(word: string, overrides: Record<string, unknown> = {}): CrawlerAnnotation {
  const { annotation, issues } = parseAnnotation(annotationItem(word, overrides), word);
  assert.ok(annotation, `fixture annotation for "${word}" must parse: ${issues.join("; ")}`);
  return annotation;
}

/** Corpus entry fixture. */
function corpusWord(word: string, level: CefrLevel = "A1"): CorpusWord {
  return { word, level, pos: "noun", band: 1, source: "test", order: 0 };
}

/** Build one valid deck word through the real pipeline helpers. */
function makeDeckWord(word: string, level: CefrLevel = "A1"): DeckWord {
  const built = buildDeckWord({
    corpusWord: corpusWord(word, level),
    annotation: annotationFor(word),
    emphasis: ["uống mỗi ngày"],
    usedIds: new Set<string>(),
  });
  assert.ok(built.deckWord, built.errors.join("; "));
  return built.deckWord;
}

/** A valid deck with two words, reused by the validation tests. */
function makeDeck(): ReturnType<typeof buildDeck> {
  return buildDeck({
    name: "Test deck",
    version: "vtest",
    words: [makeDeckWord("water", "A2"), makeDeckWord("river", "A1")],
    extraMeta: { generator: "word-crawler" },
  });
}

describe("slugifyWord", () => {
  test("produces app-compatible ids", () => {
    assert.equal(slugifyWord("apple"), "apple");
    assert.equal(slugifyWord("ice-cream"), "ice-cream");
    assert.equal(slugifyWord("can't"), "cant");
    assert.equal(slugifyWord(""), "word");
  });
});

describe("buildDeckWord", () => {
  test("keeps the corpus level even when the model echoed a different one", () => {
    const { annotation } = parseAnnotation(annotationItem("water", { level: "C1" }), "water");
    assert.ok(annotation);

    const built = buildDeckWord({
      corpusWord: corpusWord("water", "A2"),
      annotation,
      emphasis: ["uống mỗi ngày"],
      usedIds: new Set<string>(),
    });

    assert.ok(built.deckWord);
    assert.equal(built.deckWord.level, "A2");
    assert.equal(built.deckWord.chars, 5);
    assert.equal(built.deckWord.initial, "W");
    assert.deepEqual(built.deckWord.usage, [
      { en: "Please drink more _____ before running.", vi: "Hãy uống thêm nước trước khi chạy." },
    ]);
    assert.deepEqual(built.deckWord.emphasis, ["uống mỗi ngày"]);
    assert.deepEqual(built.errors, []);
  });

  test("fails cleanly without an annotation or with an unusable defVi", () => {
    const missing = buildDeckWord({
      corpusWord: corpusWord("water"),
      annotation: null,
      emphasis: [],
      usedIds: new Set<string>(),
    });
    assert.equal(missing.deckWord, null);
    assert.ok(missing.errors[0].includes("no annotation"));

    const emptyDef = buildDeckWord({
      corpusWord: corpusWord("water"),
      annotation: { ...annotationFor("water"), defVi: "" },
      emphasis: [],
      usedIds: new Set<string>(),
    });
    assert.equal(emptyDef.deckWord, null);
  });

  test("defense in depth: empties an anticipateVi that leaks the answer", () => {
    const annotation = { ...annotationFor("water"), anticipateVi: "Uống water mỗi ngày." };
    const built = buildDeckWord({
      corpusWord: corpusWord("water"),
      annotation,
      emphasis: [],
      usedIds: new Set<string>(),
    });
    assert.ok(built.deckWord);
    assert.equal(built.deckWord.anticipateVi, "");
    assert.ok(built.warnings.some((warning) => /answer/.test(warning)));
  });

  test("resolves id collisions with a numeric suffix", () => {
    const usedIds = new Set<string>();
    const first = buildDeckWord({
      corpusWord: corpusWord("can't"),
      annotation: annotationFor("can't"),
      emphasis: [],
      usedIds,
    });
    const second = buildDeckWord({
      corpusWord: corpusWord("cant"),
      annotation: annotationFor("cant"),
      emphasis: [],
      usedIds,
    });
    assert.equal(first.deckWord?.id, "cant");
    assert.equal(second.deckWord?.id, "cant-2");
    assert.ok(second.warnings.some((warning) => /taken/.test(warning)));
  });
});

describe("buildDeck and validateDeck", () => {
  test("buildDeck mirrors the app deck shape", () => {
    const deck = makeDeck();
    assert.equal(deck.meta.name, "Test deck");
    assert.equal(deck.meta.version, "vtest");
    assert.equal(deck.meta.wordCount, 2);
    assert.deepEqual(deck.meta.discoverPages, DECK_DISCOVER_PAGES);
    assert.deepEqual(deck.meta.reversePages, DECK_REVERSE_PAGES);
    assert.equal(deck.meta.generator, "word-crawler");
    assert.equal(deck.words.length, 2);
  });

  test("a freshly built deck validates cleanly and reports stats", () => {
    const report = validateDeck(makeDeck());
    assert.ok(report.ok, report.errors.join("; "));
    assert.equal(report.stats.words, 2);
    assert.deepEqual(report.stats.byLevel, { A2: 1, A1: 1 });
    assert.equal(report.stats.withEmphasis, 2);
    assert.equal(report.stats.withUsage, 2);
    assert.equal(report.stats.withIpa, 2);
    assert.deepEqual(report.stats.topics, ["health"]);
  });

  test("rejects duplicate words", () => {
    const deck = makeDeck();
    deck.words.push(structuredClone(deck.words[0]));
    const report = validateDeck(deck);
    assert.ok(!report.ok);
    assert.ok(report.errors.some((error) => /duplicate word/.test(error)));
  });

  test("rejects an unknown CEFR level", () => {
    const deck = makeDeck();
    deck.words[0] = { ...deck.words[0], level: "Z9" as CefrLevel };
    const report = validateDeck(deck);
    assert.ok(report.errors.some((error) => /not a CEFR level/.test(error)));
  });

  test("rejects an anticipateVi that leaks the English answer", () => {
    const deck = makeDeck();
    deck.words[0] = { ...deck.words[0], anticipateVi: "Uống water mỗi ngày." };
    const report = validateDeck(deck);
    assert.ok(report.errors.some((error) => /contains the English answer/.test(error)));
  });

  test("rejects emphasis that does not occur in defVi or leadVi", () => {
    const deck = makeDeck();
    deck.words[0] = { ...deck.words[0], emphasis: ["không hề xuất hiện"] };
    const report = validateDeck(deck);
    assert.ok(report.errors.some((error) => /does not occur/.test(error)));
  });

  test("rejects chars and initial mismatches", () => {
    const deck = makeDeck();
    deck.words[0] = { ...deck.words[0], chars: 99, initial: "X" };
    const report = validateDeck(deck);
    assert.ok(report.errors.some((error) => /chars/.test(error)));
    assert.ok(report.errors.some((error) => /initial/.test(error)));
  });

  test("rejects a deck without a usable words array", () => {
    assert.ok(!validateDeck({ meta: {}, words: [] }).ok);
    assert.ok(!validateDeck({ meta: {}, words: "nope" }).ok);
    assert.ok(!validateDeck("not a deck").ok);
  });
});

describe("toDeckWord (resume normalization)", () => {
  test("round-trips this package's own deck words", () => {
    const word = makeDeckWord("water", "A2");
    assert.deepEqual(toDeckWord(JSON.parse(JSON.stringify(word))), word);
  });

  test("normalizes an older mock-deck entry without emphasis", () => {
    const mockEntry = {
      id: "resilient",
      word: "resilient",
      pos: "adjective",
      ipa: "/rɪˈzɪl.i.ənt/",
      chars: 9,
      initial: "R",
      leadVi: "Một người không dễ bỏ cuộc.",
      defVi: "Có khả năng phục hồi nhanh sau khó khăn.",
      usage: [{ en: "She is _____ after setbacks.", vi: "Cô ấy rất kiên cường." }],
      topic: "personal",
      level: "B2",
      anticipateVi: "Không bỏ cuộc khi gặp khó khăn.",
    };
    const normalized = toDeckWord(mockEntry);
    assert.ok(normalized);
    assert.deepEqual(normalized.emphasis, []);
    assert.equal(normalized.level, "B2");
    assert.equal(normalized.topic, "personal");
    assert.deepEqual(normalized.usage, mockEntry.usage);
  });

  test("dedupes emphasis case-insensitively and falls back to a slug id", () => {
    const normalized = toDeckWord({
      word: "water",
      defVi: "Chất lỏng chúng ta uống.",
      level: "A1",
      emphasis: ["Chất lỏng", "chất lỏng", "chất Lỏng"],
    });
    assert.ok(normalized);
    assert.equal(normalized.id, "water");
    assert.deepEqual(normalized.emphasis, ["Chất lỏng"]);
  });

  test("returns null for entries that cannot be represented", () => {
    assert.equal(toDeckWord(null), null);
    assert.equal(toDeckWord({ word: "1st", defVi: "x y", level: "A1" }), null);
    assert.equal(toDeckWord({ word: "water", defVi: "", level: "A1" }), null);
    assert.equal(toDeckWord({ word: "water", defVi: "đủ hai ký tự", level: "D1" }), null);
    assert.equal(toDeckWord({ word: "water", defVi: "đủ hai ký tự" }), null);
  });
});
