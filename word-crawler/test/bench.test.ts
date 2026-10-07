/**
 * Vietnamese bench tests — the scorer, the frozen bench corpus, and the
 * bench command line. No network: `runOneModel` is exercised through the
 * provider resolution it shares with the crawl CLI, and the scoring fixtures
 * are hand-written Vietnamese with one deliberate defect each.
 *
 * The emphasis-reason classifier is pinned against the real warnings produced
 * by src/emphasis.ts, so a reworded warning fails here instead of silently
 * collapsing into the "other" bucket.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import type { CrawlerAnnotation } from "../src/annotate/contract.ts";
import { CliUsageError } from "../src/cli-args.ts";
import { loadCorpusFile, type CorpusWord } from "../src/corpus.ts";
import { validateEmphasis } from "../src/emphasis.ts";
import {
  BENCH_CHECKS,
  CHECK_WEIGHTS,
  classifyEmphasisWarning,
  scoreAnnotations,
  scoreWord,
} from "../src/bench/score.ts";
import {
  formatScorecard,
  parseBenchArgs,
  parseModelSpec,
  runOneModel,
  type BenchRun,
} from "../src/bench/run.ts";

/** One corpus word, as the bench requests it. */
function corpusWord(word: string, level: CorpusWord["level"] = "A1"): CorpusWord {
  return { word, level, pos: "noun", band: 1, source: "test", order: 0 };
}

/**
 * A clean annotation: real Vietnamese, both emphasis phrases quoted
 * character-for-character out of defVi, 9 words in each prose field.
 */
function goodAnnotation(overrides: Partial<CrawlerAnnotation> = {}): CrawlerAnnotation {
  return {
    word: "woman",
    pos: "noun",
    ipa: "/ˈwʊm.ən/",
    defVi: "Người trưởng thành thuộc giới tính nữ trong xã hội.",
    leadVi: "Nửa dân số thế giới mang vai trò làm mẹ.",
    anticipateVi: "Đoán xem nào…",
    usageEn: "The _____ walked into the room quietly.",
    usageVi: "Người phụ nữ bước vào phòng một cách nhẹ nhàng.",
    topic: "society",
    emphasisVi: ["trưởng thành", "giới tính"],
    ...overrides,
  };
}

describe("classifyEmphasisWarning", () => {
  test("a phrase that is not in the text is notQuoted", () => {
    const result = validateEmphasis({
      defVi: "Chất lỏng trong suốt mà ta uống mỗi ngày.",
      emphasisVi: ["Chat long"],
    });
    assert.equal(result.emphasis.length, 0);
    assert.equal(classifyEmphasisWarning(result.warnings[0]), "notQuoted");
  });

  test("half a compound is compoundHalf", () => {
    const result = validateEmphasis({
      defVi: "Người học sinh đến trường mỗi buổi sáng sớm nay.",
      emphasisVi: ["sinh"],
    });
    assert.equal(result.emphasis.length, 0);
    assert.equal(classifyEmphasisWarning(result.warnings[0]), "compoundHalf");
  });

  test("a function-word phrase is functionWords", () => {
    const result = validateEmphasis({
      defVi: "Chất lỏng của những ngày hè nóng bức ở đây.",
      emphasisVi: ["của những"],
    });
    assert.equal(result.emphasis.length, 0);
    assert.equal(classifyEmphasisWarning(result.warnings[0]), "functionWords");
  });

  test("the shorter of two overlapping phrases is overlap", () => {
    const result = validateEmphasis({
      defVi: "Khoảng thời gian dài mà ta phải chờ đợi thêm.",
      emphasisVi: ["Khoảng thời gian", "thời gian"],
    });
    assert.deepEqual(result.emphasis, ["Khoảng thời gian"]);
    assert.ok(result.warnings.some((warning) => classifyEmphasisWarning(warning) === "overlap"));
  });

  test("an unknown warning falls back to other", () => {
    assert.equal(classifyEmphasisWarning("emphasisVi: something new happened"), "other");
  });
});

describe("scoreWord", () => {
  test("a clean annotation passes every check and scores 100", () => {
    const result = scoreWord(corpusWord("woman"), goodAnnotation());
    assert.deepEqual(result.defects, []);
    assert.equal(result.score, 100);
    for (const check of BENCH_CHECKS) {
      assert.ok(result.checks[check], `${check} should pass`);
    }
    assert.equal(result.emphasisProposed, 2);
    assert.equal(result.emphasisKept, 2);
  });

  test("a missing word fails every check and scores 0", () => {
    const result = scoreWord(corpusWord("woman"), null);
    assert.equal(result.score, 0);
    assert.ok(!result.checks.returned);
    assert.match(result.defects[0], /no usable annotation/u);
  });

  test("an English word in defVi fails vietnameseOnly only", () => {
    const result = scoreWord(
      corpusWord("woman"),
      goodAnnotation({ defVi: "Người trưởng thành thuộc giới tính female trong that xã hội." }),
    );
    assert.ok(!result.checks.vietnameseOnly);
    assert.ok(result.checks.diacritics, "the sentence is still mostly diacriticked");
    assert.ok(
      result.defects.some((defect) => defect.includes("female")),
      "a word Vietnamese cannot spell is caught by the syllable check",
    );
    assert.ok(
      result.defects.some((defect) => defect.includes("that")),
      "a word that fits the syllable pattern is caught by the marker list",
    );
    assert.equal(result.score, 100 - CHECK_WEIGHTS.vietnameseOnly);
  });

  test("the English target word in defVi is a leak", () => {
    const result = scoreWord(
      corpusWord("woman"),
      goodAnnotation({ defVi: "Một woman là người trưởng thành thuộc giới tính nữ." }),
    );
    assert.ok(!result.checks.vietnameseOnly);
    assert.ok(result.defects.some((defect) => defect.includes('English target "woman"')));
  });

  test("accent-stripped Vietnamese fails diacritics", () => {
    const result = scoreWord(
      corpusWord("woman"),
      goodAnnotation({ defVi: "Nguoi truong thanh thuoc gioi tinh nu trong xa hoi." }),
    );
    assert.ok(!result.checks.diacritics);
    assert.ok(result.defects.some((defect) => defect.includes("diacritic")));
  });

  test("a dangling quantifier fails completeSentence", () => {
    const result = scoreWord(
      corpusWord("thing"),
      goodAnnotation({ defVi: "Chúng ta cần có những này trong cuộc sống hằng ngày." }),
    );
    assert.ok(!result.checks.completeSentence);
    assert.ok(result.defects.some((defect) => defect.includes("những này")));
  });

  test("an empty leadVi fails completeSentence", () => {
    const result = scoreWord(corpusWord("woman"), goodAnnotation({ leadVi: "" }));
    assert.ok(!result.checks.completeSentence);
  });

  test("emphasis that cuts a compound in half fails emphasisWhole", () => {
    const result = scoreWord(
      corpusWord("teacher"),
      goodAnnotation({
        defVi: "Người học sinh đến trường gặp giáo viên mỗi sáng.",
        emphasisVi: ["sinh", "giáo viên"],
      }),
    );
    assert.ok(!result.checks.emphasisWhole);
    assert.equal(result.emphasisProposed, 2);
    assert.equal(result.emphasisKept, 1);
    assert.equal(result.emphasisDrops.compoundHalf, 1);
    assert.ok(!result.checks.emphasisEnough, "one survivor is below the 2-4 the prompt asks for");
  });

  test("no emphasis proposed fails emphasisWhole and emphasisEnough", () => {
    const result = scoreWord(corpusWord("woman"), goodAnnotation({ emphasisVi: [] }));
    assert.ok(!result.checks.emphasisWhole);
    assert.ok(!result.checks.emphasisEnough);
    assert.ok(result.defects.some((defect) => defect.includes("no phrases proposed")));
  });

  test("prose outside 8-11 words fails proseLength", () => {
    const result = scoreWord(
      corpusWord("woman"),
      goodAnnotation({ defVi: "Người trưởng thành giới tính nữ." }),
    );
    assert.ok(!result.checks.proseLength);
    assert.ok(result.defects.some((defect) => defect.includes("the prompt asks for")));
  });

  test("a usage sentence without exactly one blank fails usageBlank", () => {
    const noBlank = scoreWord(
      corpusWord("woman"),
      goodAnnotation({ usageEn: "The person walked into the room quietly." }),
    );
    assert.ok(!noBlank.checks.usageBlank);
    const twoBlanks = scoreWord(
      corpusWord("woman"),
      goodAnnotation({ usageEn: "The _____ met the _____ there." }),
    );
    assert.ok(!twoBlanks.checks.usageBlank);
  });

  test("out-of-contract pos, topic or ipa fails fieldsValid", () => {
    const result = scoreWord(
      corpusWord("woman"),
      goodAnnotation({ pos: "substantive", topic: "gender", ipa: "wum-an" }),
    );
    assert.ok(!result.checks.fieldsValid);
    assert.ok(result.defects.some((defect) => defect.includes("substantive")));
    assert.ok(result.defects.some((defect) => defect.includes("gender")));
    assert.ok(result.defects.some((defect) => defect.includes("wum-an")));
  });

  test("the level always comes from the corpus, never from the model", () => {
    const result = scoreWord(corpusWord("woman", "C1"), goodAnnotation());
    assert.equal(result.level, "C1");
  });
});

describe("scoreAnnotations", () => {
  const requested = [corpusWord("woman"), corpusWord("man"), corpusWord("thing")];

  test("a perfect run scores 100 and a half-returned run is penalised, not ignored", () => {
    const perfect = scoreAnnotations(requested, [
      goodAnnotation({ word: "woman" }),
      goodAnnotation({ word: "man" }),
      goodAnnotation({ word: "thing" }),
    ]);
    assert.equal(perfect.words, 3);
    assert.equal(perfect.score, 100);
    assert.equal(perfect.rates.returned, 1);

    const partial = scoreAnnotations(requested, [goodAnnotation({ word: "woman" })]);
    assert.equal(partial.words, 3, "missing words still count as bench words");
    assert.ok(Math.abs(partial.rates.returned - 1 / 3) < 1e-9);
    assert.ok(Math.abs(partial.score - 100 / 3) < 1e-9);
  });

  test("the weights sum to 100, so a perfect run is exactly 100", () => {
    const total = BENCH_CHECKS.reduce((sum, check) => sum + CHECK_WEIGHTS[check], 0);
    assert.equal(total, 100);
  });

  test("emphasis survival aggregates across words", () => {
    const result = scoreAnnotations(requested, [
      goodAnnotation({ word: "woman" }),
      goodAnnotation({
        word: "man",
        defVi: "Người học sinh đến trường gặp giáo viên mỗi sáng.",
        emphasisVi: ["sinh", "giáo viên"],
      }),
      goodAnnotation({ word: "thing" }),
    ]);
    assert.equal(result.emphasisProposed, 6);
    assert.equal(result.emphasisKept, 5);
    assert.equal(result.emphasisDrops.compoundHalf, 1);
    assert.ok(Math.abs(result.emphasisSurvival - 5 / 6) < 1e-9);
  });

  test("an empty run reports zero, not NaN", () => {
    const result = scoreAnnotations(requested, []);
    assert.equal(result.score, 0);
    assert.equal(result.emphasisSurvival, 1, "nothing proposed means nothing was lost");
    for (const check of BENCH_CHECKS) assert.equal(result.rates[check], 0);
  });
});

describe("the frozen bench corpus", () => {
  /** Data files are resolved relative to this test, not to the working directory. */
  const dataFile = (name: string) => fileURLToPath(new URL(`../data/${name}`, import.meta.url));
  const corpus = loadCorpusFile(dataFile("bench-sample.json"));

  test("loads, is CC BY-SA 4.0, and documents every word's stress case", () => {
    assert.equal(corpus.words.length, 24);
    assert.equal(corpus.meta.license, "CC BY-SA 4.0");
    assert.match(String(corpus.meta.derivedFrom), /ngsl-starter-subset\.json/u);
    const stressCases = corpus.meta.stressCases as Record<string, string>;
    for (const word of corpus.words) {
      assert.ok(
        typeof stressCases[word.word] === "string" && stressCases[word.word].length > 0,
        `${word.word} needs a documented reason for being in the bench set`,
      );
    }
  });

  test("every bench word really is in the bundled corpus, at the same level", () => {
    const bundled = new Map(
      loadCorpusFile(dataFile("ngsl-starter-subset.json")).words.map((word) => [word.word, word]),
    );
    for (const word of corpus.words) {
      const source = bundled.get(word.word);
      assert.ok(source !== undefined, `${word.word} is not in the bundled corpus`);
      assert.equal(word.level, source.level, `${word.word} must keep its corpus level`);
      assert.equal(word.pos, source.pos);
    }
  });

  test("the prompt's own example word is excluded", () => {
    assert.ok(!corpus.words.some((word) => word.word === "water"));
  });

  test("it spans the difficulty range", () => {
    const levels = new Set(corpus.words.map((word) => word.level));
    assert.deepEqual([...levels].sort(), ["A1", "A2", "B1", "B2", "C1"]);
  });
});

describe("parseModelSpec", () => {
  test("splits on the first colon only, so slashed model ids survive", () => {
    assert.deepEqual(parseModelSpec("together:meta-llama/Llama-3.3-70B-Instruct-Turbo"), {
      label: "together:meta-llama/Llama-3.3-70B-Instruct-Turbo",
      provider: "together",
      model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      baseUrl: null,
    });
  });

  test("a bare provider keeps its default model", () => {
    assert.deepEqual(parseModelSpec("anthropic"), {
      label: "anthropic",
      provider: "anthropic",
      model: null,
      baseUrl: null,
    });
  });

  test("rejects unknown providers and empty models", () => {
    assert.throws(() => parseModelSpec("gemini:pro"), CliUsageError);
    assert.throws(() => parseModelSpec("anthropic:"), CliUsageError);
    assert.throws(() => parseModelSpec("  "), CliUsageError);
  });
});

describe("parseBenchArgs", () => {
  test("defaults point at the frozen set and a small batch", () => {
    const args = parseBenchArgs(["--models", "anthropic"]);
    assert.match(args.corpusPath, /data\/bench-sample\.json$/u);
    assert.equal(args.reportPath, "out/bench-report.json");
    assert.equal(args.batchSize, 8);
    assert.equal(args.maxTokens, 32000, "reasoning models bill thinking against max_tokens");
    assert.equal(args.timeoutMs, 290_000, "and they take minutes, not seconds");
    assert.equal(args.limit, null);
    assert.equal(args.dryRun, false);
    assert.equal(args.models.length, 1);
  });

  test("--models accepts a comma-separated list and repeats of the flag", () => {
    const args = parseBenchArgs([
      "--models",
      "anthropic:claude-opus-5-5,anthropic:claude-haiku-4-5",
      "--models",
      "together",
    ]);
    assert.deepEqual(
      args.models.map((spec) => spec.label),
      ["anthropic:claude-opus-5-5", "anthropic:claude-haiku-4-5", "together"],
    );
  });

  test("--models is required", () => {
    assert.throws(() => parseBenchArgs([]), CliUsageError);
    assert.throws(() => parseBenchArgs(["--dry-run"]), CliUsageError);
  });

  test("--help needs no models", () => {
    assert.equal(parseBenchArgs(["--help"]).help, true);
  });

  test("numeric flags are range-checked", () => {
    assert.throws(() => parseBenchArgs(["--models", "anthropic", "--batch", "0"]), CliUsageError);
    assert.throws(() => parseBenchArgs(["--models", "anthropic", "--batch", "51"]), CliUsageError);
    assert.throws(
      () => parseBenchArgs(["--models", "anthropic", "--temperature", "3"]),
      CliUsageError,
    );
    assert.throws(() => parseBenchArgs(["--models", "anthropic", "--batch"]), CliUsageError);
    // Node's fetch gives up at 300s whatever we ask for, so the flag stops there.
    assert.throws(
      () => parseBenchArgs(["--models", "anthropic", "--timeout", "300001"]),
      CliUsageError,
    );
    assert.equal(parseBenchArgs(["--models", "anthropic", "--timeout", "60000"]).timeoutMs, 60_000);
    assert.throws(() => parseBenchArgs(["--whatever"]), CliUsageError);
  });
});

describe("runOneModel", () => {
  test("a missing API key is reported as an unrunnable model, not a crash", async () => {
    const args = parseBenchArgs(["--models", "anthropic"]);
    const run = await runOneModel(
      args.models[0],
      [corpusWord("woman")],
      args,
      {},
      () => {},
    );
    assert.equal(run.score, null);
    assert.match(String(run.error), /No API key found for Anthropic/u);
  });

  test("an unresolvable provider is reported the same way", async () => {
    const args = parseBenchArgs(["--models", "openai"]);
    const run = await runOneModel(args.models[0], [corpusWord("woman")], args, {}, () => {});
    assert.equal(run.score, null);
    assert.match(String(run.error), /needs --base-url/u);
  });
});

describe("formatScorecard", () => {
  /** A scored run built without the network. */
  function run(label: string, annotations: CrawlerAnnotation[]): BenchRun {
    return {
      label,
      provider: "test",
      model: label,
      score: scoreAnnotations([corpusWord("woman")], annotations),
      annotations,
      issues: [],
      failedBatches: [],
      inputTokens: 0,
      outputTokens: 0,
      truncated: false,
      elapsedMs: 0,
      error: null,
    };
  }

  test("prints one column per model with the score line", () => {
    const text = formatScorecard([
      run("good", [goodAnnotation()]),
      run("bad", [goodAnnotation({ defVi: "Nguoi truong thanh thuoc gioi tinh nu trong xa hoi." })]),
    ]);
    assert.match(text, /good/u);
    assert.match(text, /bad/u);
    assert.match(text, /SCORE \/100/u);
    assert.match(text, /100\.0/u);
    assert.match(text, /Emphasis phrases rejected, by reason/u);
  });

  test("surfaces run problems so a low score is never read as bad Vietnamese", () => {
    const broken = { ...run("broken", []), truncated: true, error: "no key" };
    const text = formatScorecard([run("good", [goodAnnotation()]), broken]);
    assert.match(text, /Run problems/u);
    assert.match(text, /not run — no key/u);
    assert.match(text, /max_tokens/u);
  });

  test("says so when nothing could be scored", () => {
    const unrunnable = { ...run("x", []), score: null, error: "no key" };
    assert.match(formatScorecard([unrunnable]), /No model produced a scoreable run/u);
  });
});
