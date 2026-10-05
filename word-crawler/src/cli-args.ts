/**
 * CLI argument parsing — pure functions, no side effects, fully testable.
 *
 * Responsibility: turn `process.argv.slice(2)` into a typed command object and
 * render the help text. Every invalid combination produces a CliUsageError
 * with an actionable message; nothing here touches the network or the disk.
 *
 * Exports: CliUsageError, CliCommand, CrawlCommand, ValidateCommand,
 *          ImportCommand, HelpCommand, parseCliArgs, formatHelp,
 *          resolveCrawlOutputPath, CRAWL_DEFAULT_BATCH_SIZE
 * Depends on: ./corpus.ts
 */
import { parseLevelList, type CefrLevel } from "./corpus.ts";

/** Raised for anything the user can fix by changing the command line. */
export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

/** Words per request when `--batch` is omitted. */
export const CRAWL_DEFAULT_BATCH_SIZE = 20;

/** Maximum words per request; larger batches raise the truncation risk. */
export const CRAWL_MAX_BATCH_SIZE = 50;

/** Annotation providers accepted by `--provider`. */
export const CRAWL_PROVIDERS = ["anthropic", "together", "openrouter", "openai"] as const;

/** Provider used when neither `--provider` nor `$LLM_PROVIDER` is set. */
export const CRAWL_DEFAULT_PROVIDER = "anthropic";

/** `crawl` command options. */
export interface CrawlCommand {
  command: "crawl";
  levels: CefrLevel[];
  batchSize: number;
  limit: number | null;
  outputPath: string | null;
  resumePath: string | null;
  corpusPath: string | null;
  /** Null when the flag was omitted, so `$LLM_PROVIDER` can still decide. */
  provider: string | null;
  baseUrl: string | null;
  model: string | null;
  maxTokens: number | null;
  temperature: number | null;
  deckName: string | null;
  deckVersion: string | null;
  dryRun: boolean;
}

/** `validate <deck>` command. */
export interface ValidateCommand {
  command: "validate";
  deckPath: string;
}

/** `corpus:import` command. */
export interface ImportCommand {
  command: "corpus:import";
  inputPath: string;
  outputPath: string;
  source: string;
  name: string;
  license: string;
  licenseUrl: string;
  attribution: string;
  url: string;
  level: CefrLevel | null;
}

/** `--help` / no arguments. */
export interface HelpCommand {
  command: "help";
}

/** Any parsed command. */
export type CliCommand = CrawlCommand | ValidateCommand | ImportCommand | HelpCommand;

/** Read the value that must follow a flag. */
function readValue(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new CliUsageError(`Missing value for ${flag}`);
  }
  return value;
}

/** Parse a positive integer flag. */
function readInteger(raw: string, flag: string, max: number): number {
  if (!/^\d+$/.test(raw)) throw new CliUsageError(`${flag} must be a whole number, got "${raw}"`);
  const value = Number(raw);
  if (value < 1) throw new CliUsageError(`${flag} must be at least 1`);
  if (value > max) throw new CliUsageError(`${flag} must be at most ${max}`);
  return value;
}

/** Parse the `crawl` sub-command. */
function parseCrawl(argv: readonly string[]): CliCommand {
  const crawl: CrawlCommand = {
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
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    switch (flag) {
      case "--help":
      case "-h":
        return { command: "help" };
      case "--dry-run":
        crawl.dryRun = true;
        break;
      case "--levels": {
        const value = readValue(argv, index, flag);
        index += 1;
        try {
          crawl.levels = parseLevelList(value);
        } catch (error) {
          throw new CliUsageError(error instanceof Error ? error.message : String(error));
        }
        break;
      }
      case "--batch":
        crawl.batchSize = readInteger(readValue(argv, index, flag), flag, CRAWL_MAX_BATCH_SIZE);
        index += 1;
        break;
      case "--limit":
        crawl.limit = readInteger(readValue(argv, index, flag), flag, 100_000);
        index += 1;
        break;
      case "--output":
        crawl.outputPath = readValue(argv, index, flag);
        index += 1;
        break;
      case "--resume":
        crawl.resumePath = readValue(argv, index, flag);
        index += 1;
        break;
      case "--corpus":
        crawl.corpusPath = readValue(argv, index, flag);
        index += 1;
        break;
      case "--provider": {
        const value = readValue(argv, index, flag).toLowerCase();
        index += 1;
        if (!CRAWL_PROVIDERS.includes(value as (typeof CRAWL_PROVIDERS)[number])) {
          throw new CliUsageError(
            `--provider must be one of ${CRAWL_PROVIDERS.join(", ")}, got "${value}"`,
          );
        }
        crawl.provider = value;
        break;
      }
      case "--base-url":
        crawl.baseUrl = readValue(argv, index, flag);
        index += 1;
        break;
      case "--temperature": {
        const value = readValue(argv, index, flag);
        index += 1;
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed < 0 || parsed > 2) {
          throw new CliUsageError(`--temperature must be a number between 0 and 2, got "${value}"`);
        }
        crawl.temperature = parsed;
        break;
      }
      case "--model":
        crawl.model = readValue(argv, index, flag);
        index += 1;
        break;
      case "--max-tokens":
        crawl.maxTokens = readInteger(readValue(argv, index, flag), flag, 64_000);
        index += 1;
        break;
      case "--name":
        crawl.deckName = readValue(argv, index, flag);
        index += 1;
        break;
      case "--deck-version":
        crawl.deckVersion = readValue(argv, index, flag);
        index += 1;
        break;
      default:
        throw new CliUsageError(`Unknown crawl option "${flag}". Run with --help for the list.`);
    }
  }

  if (crawl.outputPath === null && crawl.resumePath === null) {
    throw new CliUsageError("crawl needs --output <deck.json> (or --resume <deck.json> to update one in place)");
  }
  return crawl;
}

/** Parse the `validate` sub-command. */
function parseValidate(argv: readonly string[]): CliCommand {
  if (argv.includes("--help") || argv.includes("-h")) return { command: "help" };
  if (argv.length !== 1 || argv[0].startsWith("--")) {
    throw new CliUsageError("Usage: validate <deck.json>");
  }
  return { command: "validate", deckPath: argv[0] };
}

/** Parse the `corpus:import` sub-command. */
function parseImport(argv: readonly string[]): CliCommand {
  const command: ImportCommand = {
    command: "corpus:import",
    inputPath: "",
    outputPath: "",
    source: "ngsl",
    name: "Imported corpus",
    license: "",
    licenseUrl: "",
    attribution: "",
    url: "",
    level: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    switch (flag) {
      case "--help":
      case "-h":
        return { command: "help" };
      case "--input":
        command.inputPath = readValue(argv, index, flag);
        index += 1;
        break;
      case "--output":
        command.outputPath = readValue(argv, index, flag);
        index += 1;
        break;
      case "--source":
        command.source = readValue(argv, index, flag);
        index += 1;
        break;
      case "--name":
        command.name = readValue(argv, index, flag);
        index += 1;
        break;
      case "--license":
        command.license = readValue(argv, index, flag);
        index += 1;
        break;
      case "--license-url":
        command.licenseUrl = readValue(argv, index, flag);
        index += 1;
        break;
      case "--attribution":
        command.attribution = readValue(argv, index, flag);
        index += 1;
        break;
      case "--url":
        command.url = readValue(argv, index, flag);
        index += 1;
        break;
      case "--level": {
        const value = readValue(argv, index, flag).toUpperCase();
        index += 1;
        const levels = parseLevelList(value);
        if (levels.length !== 1) throw new CliUsageError("--level takes exactly one CEFR level");
        command.level = levels[0];
        break;
      }
      default:
        throw new CliUsageError(`Unknown corpus:import option "${flag}". Run with --help for the list.`);
    }
  }

  if (command.inputPath.length === 0) throw new CliUsageError("corpus:import needs --input <list.csv|list.tsv>");
  if (command.outputPath.length === 0) throw new CliUsageError("corpus:import needs --output <corpus.json>");
  if (command.license.length === 0 || command.attribution.length === 0) {
    throw new CliUsageError(
      "corpus:import needs --license and --attribution: NGSL/NAWL are CC BY-SA 4.0 and require attribution.",
    );
  }
  return command;
}

/**
 * Parse the full argument vector (without `node` and the script path).
 * @param argv - e.g. ["crawl", "--levels", "A1,A2", "--output", "out/deck.json"]
 * @returns typed command, or a help request
 * @throws CliUsageError for unknown flags, missing values and bad numbers
 */
export function parseCliArgs(argv: readonly string[]): CliCommand {
  const [head, ...rest] = argv;
  if (head === undefined || head === "help" || head === "--help" || head === "-h") {
    return { command: "help" };
  }
  if (head === "crawl") return parseCrawl(rest);
  if (head === "validate") return parseValidate(rest);
  if (head === "corpus:import" || head === "import") return parseImport(rest);
  throw new CliUsageError(`Unknown command "${head}". Run with --help for the available commands.`);
}

/**
 * Resolve the deck path a crawl writes to: `--output`, or the resume deck when
 * `--resume` was given (the deck is then updated in place, atomically).
 *
 * @param command - parsed crawl command
 * @returns deck path (never null: the parser guarantees one of the two flags)
 */
export function resolveCrawlOutputPath(command: CrawlCommand): string {
  const path = command.outputPath ?? command.resumePath;
  if (path === null) throw new CliUsageError("crawl needs --output or --resume");
  return path;
}

/**
 * Help text shown by `--help` and after usage errors.
 * @returns multi-line usage documentation
 */
export function formatHelp(): string {
  return [
    "word-crawler — openly licensed corpus to WordCrawler deck",
    "",
    "Usage:",
    "  npm run crawl -- [options]            Crawl corpus words and write a deck",
    "  npm run validate -- <deck.json>       Validate a deck before importing it",
    "  npm run corpus:import -- [options]    Import an official CSV/TSV word list",
    "",
    "Crawl options:",
    "  --levels A1,A2      Only crawl these CEFR levels (default: all levels)",
    "  --batch 20          Words per API request (default 20, max 50)",
    "  --limit 100         Stop after N words (smoke runs)",
    "  --output out.json   Deck file to write; required unless --resume is given",
    "  --resume deck.json  Keep and skip words from an existing deck",
    "  --corpus file.json  Corpus file (default: bundled NGSL/NAWL starter subset)",
    "  --provider name     anthropic (default) | together | openrouter | openai",
    "  --base-url url      Override the provider root (required for --provider openai)",
    "  --model name        Model id (default: $LLM_MODEL, the provider's own env var, or its preset default)",
    "  --temperature 0.4   Sampling temperature, 0-2 (OpenAI-compatible providers only)",
    "  --max-tokens 4000   Response token budget per batch",
    '  --name "Deck name"  Deck meta name',
    "  --deck-version v1   Deck meta version",
    "  --dry-run           Plan only: no API calls, no files written",
    "  --help              Show this help",
    "",
    "corpus:import options:",
    "  --input list.csv    Official list download (CSV or TSV)",
    "  --output corpus.json",
    "  --source ngsl       Source id stored on every word",
    '  --name "NGSL 1.2 full"',
    '  --license "CC BY-SA 4.0"         Required',
    "  --license-url https://creativecommons.org/licenses/by-sa/4.0/",
    '  --attribution "Browne, C., Culligan, B., & Phillips, J. (2013) ..."   Required',
    "  --level B2          Force one level instead of the band heuristic",
    "  --url https://www.newgeneralservicelist.com",
    "",
    "Examples:",
    "  npm run crawl -- --levels A1,A2 --batch 20 --output out/deck-a1a2.json",
    "  npm run crawl -- --provider together --limit 20 --output out/deck.json",
    "  npm run crawl -- --provider openrouter --model meta-llama/llama-3.3-70b-instruct --output out/deck.json",
    "  npm run crawl -- --resume out/deck-a1a2.json --limit 40",
    "  npm run crawl -- --dry-run --levels A1",
    "  npm run validate -- out/deck-a1a2.json",
    "  npm run corpus:import -- --input ngsl-with-stats.csv --output data/ngsl-full.json \\",
    '    --name "NGSL 1.2 (full)" --license "CC BY-SA 4.0" \\',
    '    --license-url https://creativecommons.org/licenses/by-sa/4.0/ --attribution "Browne, C., Culligan, B., & Phillips, J. (2013). The New General Service List."',
  ].join("\n");
}
