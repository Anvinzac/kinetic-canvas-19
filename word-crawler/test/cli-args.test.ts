/**
 * CLI argument tests — pure parsing, no process spawning.
 *
 * Every invalid combination must raise a CliUsageError (exit code 2 in the
 * CLI), and every valid one must produce a fully typed command object.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  CRAWL_DEFAULT_BATCH_SIZE,
  CliUsageError,
  formatHelp,
  parseCliArgs,
  resolveCrawlOutputPath,
  type CrawlCommand,
} from "../src/cli-args.ts";

/** Match a CliUsageError whose message contains the pattern. */
function usageError(pattern: RegExp): (error: unknown) => boolean {
  return (error: unknown) => error instanceof CliUsageError && pattern.test((error as Error).message);
}

/** Build a full CrawlCommand for resolveCrawlOutputPath tests. */
function crawlCommand(overrides: Partial<CrawlCommand>): CrawlCommand {
  return {
    command: "crawl",
    levels: [],
    batchSize: CRAWL_DEFAULT_BATCH_SIZE,
    limit: null,
    outputPath: null,
    resumePath: null,
    corpusPath: null,
    provider: null,
    baseUrl: null,
    model: null,
    maxTokens: null,
    temperature: null,
    deckName: null,
    deckVersion: null,
    dryRun: false,
    ...overrides,
  };
}

describe("command dispatch", () => {
  test("no arguments and help spellings all request help", () => {
    assert.deepEqual(parseCliArgs([]), { command: "help" });
    assert.deepEqual(parseCliArgs(["help"]), { command: "help" });
    assert.deepEqual(parseCliArgs(["--help"]), { command: "help" });
    assert.deepEqual(parseCliArgs(["-h"]), { command: "help" });
    assert.deepEqual(parseCliArgs(["crawl", "--help"]), { command: "help" });
    assert.deepEqual(parseCliArgs(["validate", "--help"]), { command: "help" });
  });

  test("an unknown command is a usage error", () => {
    assert.throws(() => parseCliArgs(["frobnicate"]), usageError(/Unknown command "frobnicate"/));
  });
});

describe("crawl parsing", () => {
  test("minimal crawl applies defaults", () => {
    assert.deepEqual(parseCliArgs(["crawl", "--output", "out/deck.json"]), {
      command: "crawl",
      levels: [],
      batchSize: CRAWL_DEFAULT_BATCH_SIZE,
      limit: null,
      outputPath: "out/deck.json",
      resumePath: null,
      corpusPath: null,
      provider: null,
      baseUrl: null,
      model: null,
      maxTokens: null,
      temperature: null,
      deckName: null,
      deckVersion: null,
      dryRun: false,
    });
  });

  test("parses every documented flag", () => {
    const command = parseCliArgs([
      "crawl",
      "--levels",
      "a2, a1",
      "--batch",
      "10",
      "--limit",
      "5",
      "--corpus",
      "my-corpus.json",
      "--provider",
      "together",
      "--base-url",
      "https://api.together.xyz/v1",
      "--temperature",
      "0.4",
      "--model",
      "claude-test",
      "--max-tokens",
      "2000",
      "--name",
      "My Deck",
      "--deck-version",
      "v2",
      "--dry-run",
      "--output",
      "out/deck.json",
    ]);
    assert.deepEqual(command, {
      command: "crawl",
      levels: ["A1", "A2"],
      batchSize: 10,
      limit: 5,
      outputPath: "out/deck.json",
      resumePath: null,
      corpusPath: "my-corpus.json",
      provider: "together",
      baseUrl: "https://api.together.xyz/v1",
      model: "claude-test",
      maxTokens: 2000,
      temperature: 0.4,
      deckName: "My Deck",
      deckVersion: "v2",
      dryRun: true,
    });
  });

  test("crawl needs an output or a resume deck", () => {
    assert.throws(() => parseCliArgs(["crawl"]), usageError(/--output/));
  });

  test("rejects an unknown provider and an out-of-range temperature", () => {
    assert.throws(
      () => parseCliArgs(["crawl", "--output", "o.json", "--provider", "gemini"]),
      usageError(/--provider must be one of/),
    );
    assert.throws(
      () => parseCliArgs(["crawl", "--output", "o.json", "--temperature", "3"]),
      usageError(/--temperature must be a number between 0 and 2/),
    );
    assert.throws(
      () => parseCliArgs(["crawl", "--output", "o.json", "--temperature", "abc"]),
      usageError(/--temperature must be a number between 0 and 2/),
    );
  });

  test("an omitted --provider leaves the decision to LLM_PROVIDER", () => {
    const command = parseCliArgs(["crawl", "--output", "o.json"]);
    assert.ok(command.command === "crawl");
    assert.equal(command.provider, null);
  });

  test("provider spelling is normalized to lowercase", () => {
    const command = parseCliArgs(["crawl", "--output", "o.json", "--provider", "OpenRouter"]);
    assert.ok(command.command === "crawl");
    assert.equal(command.provider, "openrouter");
  });

  test("rejects missing values, bad numbers and unknown flags", () => {
    assert.throws(() => parseCliArgs(["crawl", "--output"]), usageError(/Missing value for --output/));
    assert.throws(
      () => parseCliArgs(["crawl", "--output", "x.json", "--batch", "0"]),
      usageError(/at least 1/),
    );
    assert.throws(
      () => parseCliArgs(["crawl", "--output", "x.json", "--batch", "51"]),
      usageError(/at most 50/),
    );
    assert.throws(
      () => parseCliArgs(["crawl", "--output", "x.json", "--batch", "abc"]),
      usageError(/whole number/),
    );
    assert.throws(
      () => parseCliArgs(["crawl", "--output", "x.json", "--levels", "D1"]),
      usageError(/Unknown CEFR level/),
    );
    assert.throws(
      () => parseCliArgs(["crawl", "--output", "x.json", "--levels", ",,"]),
      usageError(/at least one level/),
    );
    assert.throws(
      () => parseCliArgs(["crawl", "--output", "x.json", "--frobnicate"]),
      usageError(/Unknown crawl option/),
    );
  });

  test("resume alone is enough, and output wins when both are given", () => {
    const resumeOnly = parseCliArgs(["crawl", "--resume", "deck.json"]);
    assert.ok(resumeOnly.command === "crawl");
    assert.equal(resumeOnly.resumePath, "deck.json");
    assert.equal(resumeOnly.outputPath, null);
    assert.equal(resolveCrawlOutputPath(resumeOnly), "deck.json");

    const both = parseCliArgs(["crawl", "--output", "new.json", "--resume", "deck.json"]);
    assert.ok(both.command === "crawl");
    assert.equal(resolveCrawlOutputPath(both), "new.json");
  });

  test("resolveCrawlOutputPath refuses a command without either path", () => {
    assert.throws(() => resolveCrawlOutputPath(crawlCommand({})), CliUsageError);
  });
});

describe("validate parsing", () => {
  test("takes exactly one deck path", () => {
    assert.deepEqual(parseCliArgs(["validate", "deck.json"]), {
      command: "validate",
      deckPath: "deck.json",
    });
    assert.throws(() => parseCliArgs(["validate"]), usageError(/Usage: validate/));
    assert.throws(() => parseCliArgs(["validate", "a.json", "b.json"]), usageError(/Usage: validate/));
  });
});

describe("corpus:import parsing", () => {
  test("needs input, output and licensing fields", () => {
    assert.throws(() => parseCliArgs(["corpus:import"]), usageError(/--input/));
    assert.throws(
      () => parseCliArgs(["corpus:import", "--input", "in.csv"]),
      usageError(/--output/),
    );
    assert.throws(
      () => parseCliArgs(["corpus:import", "--input", "in.csv", "--output", "out.json"]),
      usageError(/--license and --attribution/),
    );
  });

  test("parses a full import, including the level override", () => {
    const command = parseCliArgs([
      "corpus:import",
      "--input",
      "list.csv",
      "--output",
      "corpus.json",
      "--source",
      "ngsl",
      "--name",
      "NGSL 1.2",
      "--license",
      "CC BY-SA 4.0",
      "--license-url",
      "https://creativecommons.org/licenses/by-sa/4.0/",
      "--attribution",
      "Browne, C., Culligan, B., & Phillips, J. (2013).",
      "--url",
      "https://www.newgeneralservicelist.com",
      "--level",
      "c1",
    ]);
    assert.deepEqual(command, {
      command: "corpus:import",
      inputPath: "list.csv",
      outputPath: "corpus.json",
      source: "ngsl",
      name: "NGSL 1.2",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      attribution: "Browne, C., Culligan, B., & Phillips, J. (2013).",
      url: "https://www.newgeneralservicelist.com",
      level: "C1",
    });
  });

  test("the short alias 'import' works too", () => {
    const command = parseCliArgs([
      "import",
      "--input",
      "in.csv",
      "--output",
      "out.json",
      "--license",
      "CC BY-SA 4.0",
      "--attribution",
      "Browne, C., Culligan, B., & Phillips, J. (2013).",
    ]);
    assert.equal(command.command, "corpus:import");
  });
});

describe("formatHelp", () => {
  test("documents the exact task examples", () => {
    const help = formatHelp();
    assert.ok(help.includes("--levels A1,A2"));
    assert.ok(help.includes("--batch 20"));
    assert.ok(help.includes("--resume deck.json"));
    assert.ok(help.includes("--dry-run"));
    assert.ok(help.includes("npm run validate"));
  });
});
