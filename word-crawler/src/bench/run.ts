/**
 * Vietnamese annotation bench — run one fixed word set through several models
 * and print a side-by-side scorecard.
 *
 * Responsibility: process-boundary layer for the bench. It resolves `--models`
 * specs into annotators through the crawl CLI's own provider resolution (same
 * env vars, same error messages), sends each model the identical prompt and
 * identical batches, scores every run with `./score.ts`, and writes a report
 * file that keeps the raw Vietnamese so a human can read what the numbers mean.
 *
 * No deck is written: the bench measures models, it does not publish content.
 *
 * Exports: ModelSpec, parseModelSpec, shortLabel, BenchArgs, parseBenchArgs,
 *          formatHelp, BenchRun, runOneModel, formatScorecard, main
 * Depends on: ../annotate/contract.ts, ../cli.ts, ../corpus.ts, ../crawl.ts,
 *             ../json-file.ts, ./score.ts
 */
import { fileURLToPath, pathToFileURL } from "node:url";
import type { CrawlerAnnotation } from "../annotate/contract.ts";
import { LlmRequestError } from "../annotate/transport.ts";
import { CliUsageError, CRAWL_PROVIDERS, type CrawlCommand } from "../cli-args.ts";
import { createAnnotator } from "../cli.ts";
import { loadCorpusFile, prepareCorpus, type CorpusWord } from "../corpus.ts";
import { chunkWords } from "../crawl.ts";
import { writeJsonAtomic } from "../json-file.ts";
import {
  BENCH_CHECKS,
  CHECK_WEIGHTS,
  scoreAnnotations,
  type ModelScore,
} from "./score.ts";

/** The frozen comparison set, resolved relative to this module; `--corpus` overrides it. */
const DEFAULT_BENCH_CORPUS = fileURLToPath(new URL("../../data/bench-sample.json", import.meta.url));

/** Where the report goes when `--out` is omitted. */
const DEFAULT_REPORT_PATH = "out/bench-report.json";

/**
 * Words per request. Smaller than the crawl default on purpose: a short batch
 * keeps a weak model from running out of output tokens, which would otherwise
 * show up as a Vietnamese failure instead of the budget failure it is.
 */
const DEFAULT_BENCH_BATCH = 8;

/**
 * Response budget per batch. Deliberately large: reasoning models bill their
 * chain of thought against `max_tokens`, and a measured 8-word batch cost
 * GLM-5.3 about 18,700 reasoning tokens before it wrote the first character of
 * its answer. At 8000 the entire budget went to reasoning and the model scored
 * zero — a budget artefact that looks exactly like bad Vietnamese, which is the
 * one mistake this bench must not make. A truncated reply is still reported
 * under "Run problems" rather than scored.
 */
const DEFAULT_BENCH_MAX_TOKENS = 32000;

/**
 * Per-request timeout. The transport's 120s default is not enough for the same
 * reason the token budget is not: a reasoning model generates its whole chain
 * of thought before the first character of the answer. Measured on an 8-word
 * batch, GLM-5.3 took 37s and Qwen3.8-2.4T-A95B did not answer within 300s.
 *
 * Node's own fetch stops at 300s regardless, so a model that needs longer has
 * to be given a smaller `--batch`, not a bigger timeout.
 */
const DEFAULT_BENCH_TIMEOUT_MS = 290_000;

/** One `provider:model` entry from `--models`. */
export interface ModelSpec {
  /** As typed, used as the report key and the column label. */
  label: string;
  provider: string;
  /** Null means "whatever the provider preset or env var resolves to". */
  model: string | null;
  baseUrl: string | null;
}

/**
 * Parse one `--models` entry.
 *
 * Model ids contain colons and slashes (`together:meta-llama/Llama-3.3-70B`),
 * so only the first colon separates the provider from the model.
 *
 * @param spec - one comma-separated entry
 * @returns the resolved spec
 * @throws CliUsageError for an unknown provider or an empty entry
 */
export function parseModelSpec(spec: string): ModelSpec {
  const trimmed = spec.trim();
  if (trimmed.length === 0) throw new CliUsageError("--models has an empty entry");

  const separator = trimmed.indexOf(":");
  const provider = (separator === -1 ? trimmed : trimmed.slice(0, separator)).toLowerCase();
  const model = separator === -1 ? null : trimmed.slice(separator + 1).trim();

  if (!CRAWL_PROVIDERS.includes(provider as (typeof CRAWL_PROVIDERS)[number])) {
    throw new CliUsageError(
      `--models entry "${trimmed}": provider must be one of ${CRAWL_PROVIDERS.join(", ")}`,
    );
  }
  if (model !== null && model.length === 0) {
    throw new CliUsageError(`--models entry "${trimmed}": the model after ":" is empty`);
  }
  return { label: trimmed, provider, model, baseUrl: null };
}

/** Parsed bench command line. */
export interface BenchArgs {
  models: ModelSpec[];
  corpusPath: string;
  batchSize: number;
  limit: number | null;
  reportPath: string;
  maxTokens: number;
  timeoutMs: number;
  temperature: number | null;
  baseUrl: string | null;
  dryRun: boolean;
  help: boolean;
}

/** Read the value that follows a flag. */
function valueFor(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new CliUsageError(`${flag} needs a value`);
  }
  return value;
}

/** Parse a positive integer flag. */
function intFor(argv: readonly string[], index: number, flag: string, max: number): number {
  const raw = valueFor(argv, index, flag);
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new CliUsageError(`${flag} must be an integer between 1 and ${max}, got "${raw}"`);
  }
  return parsed;
}

/**
 * Parse the bench command line.
 *
 * @param argv - arguments after the script name
 * @returns parsed arguments with defaults applied
 * @throws CliUsageError for anything the user can fix on the command line
 */
export function parseBenchArgs(argv: readonly string[]): BenchArgs {
  const args: BenchArgs = {
    models: [],
    corpusPath: DEFAULT_BENCH_CORPUS,
    batchSize: DEFAULT_BENCH_BATCH,
    limit: null,
    reportPath: DEFAULT_REPORT_PATH,
    maxTokens: DEFAULT_BENCH_MAX_TOKENS,
    timeoutMs: DEFAULT_BENCH_TIMEOUT_MS,
    temperature: null,
    baseUrl: null,
    dryRun: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    switch (flag) {
      case "--help":
      case "-h":
        args.help = true;
        break;
      case "--models":
        args.models.push(
          ...valueFor(argv, index, flag)
            .split(",")
            .filter((entry) => entry.trim().length > 0)
            .map(parseModelSpec),
        );
        index += 1;
        break;
      case "--corpus":
        args.corpusPath = valueFor(argv, index, flag);
        index += 1;
        break;
      case "--batch":
        args.batchSize = intFor(argv, index, flag, 50);
        index += 1;
        break;
      case "--limit":
        args.limit = intFor(argv, index, flag, 10000);
        index += 1;
        break;
      case "--out":
        args.reportPath = valueFor(argv, index, flag);
        index += 1;
        break;
      case "--max-tokens":
        args.maxTokens = intFor(argv, index, flag, 200000);
        index += 1;
        break;
      case "--timeout":
        args.timeoutMs = intFor(argv, index, flag, 300000);
        index += 1;
        break;
      case "--temperature": {
        const raw = valueFor(argv, index, flag);
        const parsed = Number.parseFloat(raw);
        if (!Number.isFinite(parsed) || parsed < 0 || parsed > 2) {
          throw new CliUsageError(`--temperature must be between 0 and 2, got "${raw}"`);
        }
        args.temperature = parsed;
        index += 1;
        break;
      }
      case "--base-url":
        args.baseUrl = valueFor(argv, index, flag);
        index += 1;
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      default:
        throw new CliUsageError(`Unknown flag "${flag}"`);
    }
  }

  if (!args.help && args.models.length === 0) {
    throw new CliUsageError("--models is required, e.g. --models anthropic:claude-opus-5-5,together");
  }
  return args;
}

/** Usage text. */
export function formatHelp(): string {
  return [
    "Usage: npm run bench -- --models <provider:model,...> [options]",
    "",
    "Sends one frozen word set to every model with the identical annotation prompt",
    "and scores the Vietnamese with the crawler's own checkers.",
    "",
    "Options:",
    `  --models a:b,c       Required. provider:model entries (${CRAWL_PROVIDERS.join(" | ")});`,
    "                       the model may be omitted to use the provider's default",
    "  --corpus file.json   Bench word set (default: the bundled data/bench-sample.json)",
    `  --batch n            Words per request (default ${DEFAULT_BENCH_BATCH})`,
    "  --limit n            Only the first n words of the set",
    `  --out file.json      Report file (default: ${DEFAULT_REPORT_PATH})`,
    `  --max-tokens n       Response budget per batch (default ${DEFAULT_BENCH_MAX_TOKENS})`,
    `  --timeout ms         Per-request timeout (default ${DEFAULT_BENCH_TIMEOUT_MS}; Node's fetch caps at 300000)`,
    "  --temperature n      Forwarded to OpenAI-compatible providers only",
    "  --base-url url       Provider root; required for provider `openai`",
    "  --dry-run            Print the plan and the resolved models; no API calls",
    "",
    "Keys come from the environment exactly as for `npm run crawl`",
    "(ANTHROPIC_API_KEY, TOGETHER_API_KEY, OPENROUTER_API_KEY, …).",
  ].join("\n");
}

/** One model's bench outcome. */
export interface BenchRun {
  label: string;
  provider: string;
  /** The model id the provider resolution settled on. */
  model: string;
  score: ModelScore | null;
  annotations: CrawlerAnnotation[];
  /** Pipeline issues (contract repairs, missing words, truncation) verbatim. */
  issues: string[];
  /** Batches that threw; the run is still scored on what did come back. */
  failedBatches: string[];
  inputTokens: number;
  outputTokens: number;
  truncated: boolean;
  elapsedMs: number;
  /** Set when the model could not be reached or configured at all. */
  error: string | null;
}

/** Build the synthetic crawl command `createAnnotator` resolves providers from. */
function crawlCommandFor(spec: ModelSpec, args: BenchArgs): CrawlCommand {
  return {
    command: "crawl",
    levels: [],
    batchSize: args.batchSize,
    limit: args.limit,
    outputPath: null,
    resumePath: null,
    corpusPath: args.corpusPath,
    provider: spec.provider,
    baseUrl: spec.baseUrl ?? args.baseUrl,
    model: spec.model,
    maxTokens: args.maxTokens,
    timeoutMs: args.timeoutMs,
    temperature: args.temperature,
    deckName: null,
    deckVersion: null,
    dryRun: false,
  };
}

/**
 * Run the whole bench set through one model and score it.
 *
 * A failing batch is recorded and the run continues, so one truncated or
 * rate-limited request never discards the words that did come back.
 *
 * @param spec - provider and model to test
 * @param words - the bench words, in request order
 * @param args - parsed command line (batch size, budgets, provider overrides)
 * @param env - environment holding the API keys
 * @param log - progress sink
 * @returns the run, scored unless the model could not be configured at all
 */
export async function runOneModel(
  spec: ModelSpec,
  words: readonly CorpusWord[],
  args: BenchArgs,
  env: NodeJS.ProcessEnv,
  log: (message: string) => void,
): Promise<BenchRun> {
  const started = Date.now();
  const base: BenchRun = {
    label: spec.label,
    provider: spec.provider,
    model: spec.model ?? "(provider default)",
    score: null,
    annotations: [],
    issues: [],
    failedBatches: [],
    inputTokens: 0,
    outputTokens: 0,
    truncated: false,
    elapsedMs: 0,
    error: null,
  };

  let annotator;
  try {
    annotator = createAnnotator(crawlCommandFor(spec, args), env, log);
  } catch (error) {
    return {
      ...base,
      elapsedMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const annotations: CrawlerAnnotation[] = [];
  const issues: string[] = [];
  const failedBatches: string[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let truncated = false;

  const batches = chunkWords([...words], args.batchSize);
  for (const [index, batch] of batches.entries()) {
    try {
      const result = await annotator.annotateBatch(batch);
      annotations.push(...result.annotations);
      issues.push(...result.issues);
      if (result.usage !== null) {
        inputTokens += result.usage.inputTokens;
        outputTokens += result.usage.outputTokens;
      }
      if (result.stopReason === "max_tokens") truncated = true;
      log(
        `  [${index + 1}/${batches.length}] ${result.annotations.length}/${batch.length} words` +
          (result.usage === null ? "" : ` (${result.usage.inputTokens}/${result.usage.outputTokens} tokens)`),
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failedBatches.push(`batch ${index + 1}: ${reason}`);
      log(`  [${index + 1}/${batches.length}] failed: ${reason}`);
      if (error instanceof LlmRequestError && error.fatal) {
        log("  aborting this model: the provider rejected the request");
        break;
      }
    }
  }

  return {
    ...base,
    model: annotator.model,
    score: scoreAnnotations(words, annotations),
    annotations,
    issues,
    failedBatches,
    inputTokens,
    outputTokens,
    truncated,
    elapsedMs: Date.now() - started,
  };
}

/**
 * Column heading for one model: the distinctive tail of the model id.
 *
 * Model ids are long enough ("together:meta-llama/Llama-3.3-70B-Instruct-Turbo")
 * that using them as column headings makes the table unreadable, and the
 * organisation prefix is the part that carries no information in a comparison.
 *
 * @param label - the spec as typed on the command line
 * @returns a short heading; the scorecard prints the full id in a legend
 */
export function shortLabel(label: string): string {
  const tail = label.split("/").at(-1) ?? label;
  const withoutProvider = tail.includes(":") ? (tail.split(":").at(-1) ?? tail) : tail;
  return withoutProvider.length <= 24 ? withoutProvider : `${withoutProvider.slice(0, 23)}…`;
}

/** Render a ratio as a right-aligned percentage. */
function percent(value: number, width: number): string {
  return `${(value * 100).toFixed(0)}%`.padStart(width);
}

/**
 * Render the side-by-side scorecard.
 *
 * @param runs - one entry per tested model, in the order they were tested
 * @returns the text block printed at the end of a bench run
 */
export function formatScorecard(runs: readonly BenchRun[]): string {
  const scored = runs.filter((run) => run.score !== null);
  if (scored.length === 0) return "No model produced a scoreable run.";

  // The first column has to fit the longest row label, not just the header.
  const rowLabels = [
    "check",
    "emphasis kept",
    "SCORE /100",
    ...BENCH_CHECKS.map((check) => `${check} (${CHECK_WEIGHTS[check]})`),
  ];
  const labelWidth = Math.max(...rowLabels.map((label) => label.length));
  const heading = new Map(scored.map((run) => [run.label, shortLabel(run.label)]));
  const column = (run: BenchRun) => Math.max(7, heading.get(run.label)!.length);

  const lines: string[] = [];
  const header = [
    "check".padEnd(labelWidth),
    ...scored.map((run) => heading.get(run.label)!.padStart(column(run))),
  ];
  lines.push(header.join("  "));
  lines.push(["-".repeat(labelWidth), ...scored.map((run) => "-".repeat(column(run)))].join("  "));

  for (const check of BENCH_CHECKS) {
    const row = [
      `${check} (${CHECK_WEIGHTS[check]})`.padEnd(labelWidth),
      ...scored.map((run) => percent(run.score!.rates[check], column(run))),
    ];
    lines.push(row.join("  "));
  }

  lines.push(
    [
      "emphasis kept".padEnd(labelWidth),
      ...scored.map((run) =>
        `${run.score!.emphasisKept}/${run.score!.emphasisProposed}`.padStart(column(run)),
      ),
    ].join("  "),
  );
  lines.push(
    [
      "SCORE /100".padEnd(labelWidth),
      ...scored.map((run) => run.score!.score.toFixed(1).padStart(column(run))),
    ].join("  "),
  );

  lines.push("");
  lines.push("Emphasis phrases rejected, by reason:");
  for (const run of scored) {
    const reasons = Object.entries(run.score!.emphasisDrops)
      .filter(([, count]) => count > 0)
      .map(([reason, count]) => `${reason} ${count}`)
      .join(", ");
    lines.push(`  ${heading.get(run.label)}: ${reasons || "none"}`);
  }

  lines.push("");
  lines.push("Columns:");
  for (const run of scored) {
    lines.push(`  ${heading.get(run.label)} = ${run.label} (${run.model})`);
  }

  const flagged = runs.filter(
    (run) => run.error !== null || run.truncated || run.failedBatches.length > 0,
  );
  if (flagged.length > 0) {
    lines.push("");
    lines.push("Run problems (read these before trusting a low score):");
    for (const run of flagged) {
      const name = shortLabel(run.label);
      if (run.error !== null) lines.push(`  ${name}: not run — ${run.error}`);
      if (run.truncated) {
        lines.push(`  ${name}: a reply hit max_tokens — raise --max-tokens or lower --batch`);
      }
      // The full provider body is in the report; one line each keeps the
      // scorecard readable when several models fail the same way.
      for (const failure of run.failedBatches) {
        lines.push(`  ${name}: ${failure.replace(/\s+/gu, " ").slice(0, 120)}`);
      }
    }
  }

  return lines.join("\n");
}

/**
 * Bench entry point.
 *
 * @param argv - arguments after the script name
 * @param env - environment holding the API keys
 * @param log - stdout sink
 * @returns process exit code (0 ok, 1 nothing scoreable, 2 usage error)
 */
export async function main(
  argv: readonly string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
  log: (message: string) => void = console.log,
): Promise<number> {
  let args: BenchArgs;
  try {
    args = parseBenchArgs(argv);
  } catch (error) {
    if (error instanceof CliUsageError) {
      console.error(error.message);
      console.error("");
      console.error(formatHelp());
      return 2;
    }
    throw error;
  }
  if (args.help) {
    log(formatHelp());
    return 0;
  }

  const corpus = loadCorpusFile(args.corpusPath);
  const prepared = prepareCorpus(corpus);
  const words = args.limit === null ? prepared.words : prepared.words.slice(0, args.limit);
  const batches = chunkWords([...words], args.batchSize);

  log(`bench set: ${words.length} words from ${corpus.path}`);
  log(`           ${batches.length} batch(es) of up to ${args.batchSize}, identical for every model`);
  log(`models:    ${args.models.map((spec) => spec.label).join(", ")}`);

  if (args.dryRun) {
    for (const [index, batch] of batches.entries()) {
      log(`[dry-run] batch ${index + 1}: ${batch.map((word) => word.word).join(", ")}`);
    }
    for (const spec of args.models) {
      try {
        const annotator = createAnnotator(crawlCommandFor(spec, args), env, () => {});
        log(`[dry-run] ${spec.label} -> ${annotator.model} (key found)`);
      } catch (error) {
        log(`[dry-run] ${spec.label} -> NOT RUNNABLE: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    log("[dry-run] no API calls made, no report written");
    return 0;
  }

  const runs: BenchRun[] = [];
  for (const spec of args.models) {
    log("");
    log(`${spec.label}:`);
    runs.push(await runOneModel(spec, words, args, env, log));
  }

  await writeJsonAtomic(args.reportPath, {
    meta: {
      generator: "word-crawler bench",
      generatedAt: new Date().toISOString(),
      corpus: {
        path: corpus.path,
        name: corpus.meta.name,
        version: corpus.meta.version,
        kind: corpus.meta.kind,
        license: corpus.meta.license,
        licenseUrl: corpus.meta.licenseUrl,
        derivedFrom: corpus.meta.derivedFrom,
      },
      words: words.map((word) => word.word),
      batchSize: args.batchSize,
      maxTokens: args.maxTokens,
      timeoutMs: args.timeoutMs,
      temperature: args.temperature,
      checkWeights: CHECK_WEIGHTS,
    },
    runs,
  });

  log("");
  log(formatScorecard(runs));
  log("");
  log(`report: ${args.reportPath} (per-word defects and the raw Vietnamese are in there)`);

  return runs.some((run) => run.score !== null) ? 0 : 1;
}

const entryPoint = process.argv[1];
if (entryPoint !== undefined && import.meta.url === pathToFileURL(entryPoint).href) {
  main().then((code) => {
    process.exitCode = code;
  });
}
