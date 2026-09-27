/**
 * CLI entry point — wires the parsed command to the pipeline and prints reports.
 *
 * Responsibility: keep process-boundary concerns (argv, env, exit codes,
 * stdout) in one thin layer. All logic lives in the modules this file calls,
 * so every command is testable without spawning a process.
 *
 * Exit codes: 0 = success, 1 = run/validation failure, 2 = usage error.
 *
 * Exports: main, runCrawlCommand, runValidateCommand, runImportCommand
 * Depends on: node:fs, node:path, node:url, ./cli-args.ts, ./corpus.ts,
 *             ./corpus-import.ts, ./crawl.ts, ./deck.ts, ./json-file.ts,
 *             ./annotate/anthropic.ts
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";
import { AnthropicBatchAnnotator, DEFAULT_ANTHROPIC_MODEL } from "./annotate/anthropic.ts";
import {
  CliUsageError,
  formatHelp,
  parseCliArgs,
  resolveCrawlOutputPath,
  type CrawlCommand,
  type ImportCommand,
} from "./cli-args.ts";
import { parseCorpus } from "./corpus.ts";
import { importCorpusFromText } from "./corpus-import.ts";
import { runCrawl } from "./crawl.ts";
import { validateDeck } from "./deck.ts";
import { readJsonFile, writeJsonAtomic } from "./json-file.ts";

/** `validate <deck.json>`: print a full report; exit 1 when the deck has errors. */
export async function runValidateCommand(
  deckPath: string,
  log: (message: string) => void = console.log,
): Promise<number> {
  try {
    const report = validateDeck(readJsonFile(deckPath));
    log(`Deck: ${deckPath}`);
    log(`Words: ${report.stats.words}`);
    const levels = Object.entries(report.stats.byLevel)
      .map(([level, count]) => `${level}:${count}`)
      .join(", ");
    log(`Levels: ${levels || "none"}`);
    log(`Topics: ${report.stats.topics.join(", ") || "none"}`);
    log(
      `Coverage: emphasis ${report.stats.withEmphasis}/${report.stats.words}, ` +
        `usage ${report.stats.withUsage}/${report.stats.words}, ipa ${report.stats.withIpa}/${report.stats.words}`,
    );

    if (report.warnings.length > 0) {
      log(`Warnings (${report.warnings.length}):`);
      for (const warning of report.warnings.slice(0, 30)) log(`  - ${warning}`);
      if (report.warnings.length > 30) log(`  …and ${report.warnings.length - 30} more`);
    }
    if (!report.ok) {
      log(`Errors (${report.errors.length}):`);
      for (const error of report.errors.slice(0, 50)) log(`  - ${error}`);
      if (report.errors.length > 50) log(`  …and ${report.errors.length - 50} more`);
      return 1;
    }
    log("Deck is valid for import.");
    return 0;
  } catch (error) {
    log(`Cannot validate ${deckPath}: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

/** `corpus:import`: convert an official CSV/TSV download into corpus JSON. */
export async function runImportCommand(
  command: ImportCommand,
  log: (message: string) => void = console.log,
): Promise<number> {
  try {
    const text = readFileSync(command.inputPath, "utf8");
    const { corpus, summary } = importCorpusFromText(text, {
      name: command.name,
      source: command.source,
      license: command.license,
      licenseUrl: command.licenseUrl,
      attribution: command.attribution,
      url: command.url,
      level: command.level ?? undefined,
    });
    // Fail fast if the produced file would not load as a corpus.
    parseCorpus(corpus, command.outputPath);
    await writeJsonAtomic(command.outputPath, corpus);
    log(`Imported ${summary.wordsKept} words from ${command.inputPath}`);
    log(
      `Skipped ${summary.rowsSkipped} non-word line(s), collapsed ${summary.duplicatesDropped} duplicate row(s)`,
    );
    log(`Wrote ${command.outputPath}. Crawl it with: npm run crawl -- --corpus ${command.outputPath} --output out/deck.json`);
    log("Keep the attribution text in NOTICE.md whenever this corpus is distributed.");
    return 0;
  } catch (error) {
    log(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

/** `crawl`: run the pipeline and print the report. */
export async function runCrawlCommand(
  command: CrawlCommand,
  env: NodeJS.ProcessEnv = process.env,
  log: (message: string) => void = console.log,
): Promise<number> {
  try {
    const outputPath = resolveCrawlOutputPath(command);
    const model = command.model ?? env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL;
    const annotator = command.dryRun
      ? undefined
      : new AnthropicBatchAnnotator({
          apiKey: env.ANTHROPIC_API_KEY ?? "",
          model,
          maxTokens: command.maxTokens ?? undefined,
          log: (message) => log(`  · ${message}`),
        });

    const report = await runCrawl(
      {
        corpusPath: command.corpusPath ?? "",
        levels: command.levels,
        batchSize: command.batchSize,
        limit: command.limit ?? undefined,
        outputPath,
        resumePath: command.resumePath ?? undefined,
        deckName: command.deckName ?? `WordCrawler ${basename(outputPath).replace(/\.json$/i, "")}`,
        deckVersion: command.deckVersion ?? "v1",
        model,
        dryRun: command.dryRun,
      },
      { annotator, log },
    );

    log("");
    log(`Crawl summary${report.dryRun ? " (dry run — nothing written)" : ""}:`);
    log(`  corpus: ${report.corpusWords} words (${report.duplicatesDropped} duplicates dropped) — ${report.corpusPath}`);
    log(`  already known: ${report.knownWords}; planned: ${report.plannedWords}; batches: ${report.batches}`);
    log(`  annotated this run: ${report.annotatedWords}; deck words: ${report.deckWords}`);
    if (report.missingWords.length > 0) {
      log(`  missing after this run (${report.missingWords.length}): ${report.missingWords.slice(0, 10).join(", ")}${report.missingWords.length > 10 ? ", …" : ""}`);
    }
    if (report.warnings.length > 0) log(`  warnings: ${report.warnings.length} (see the log above)`);
    if (report.errors.length > 0) {
      log(`  errors (${report.errors.length}):`);
      for (const error of report.errors) log(`    - ${error}`);
      return 1;
    }
    log(report.deckWritten ? `  wrote: ${report.outputPath}` : "  no deck written");
    return 0;
  } catch (error) {
    if (error instanceof CliUsageError) {
      log(error.message);
      return 2;
    }
    log(`Crawl failed: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

/**
 * Parse argv and dispatch.
 * @param argv - arguments after the script path (defaults to process.argv)
 * @param env - environment used for the API key and model default
 * @returns process exit code
 */
export async function main(
  argv: readonly string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  let command;
  try {
    command = parseCliArgs(argv);
  } catch (error) {
    if (error instanceof CliUsageError) {
      console.error(error.message);
      console.error("");
      console.error(formatHelp());
      return 2;
    }
    throw error;
  }

  switch (command.command) {
    case "help":
      console.log(formatHelp());
      return 0;
    case "validate":
      return runValidateCommand(command.deckPath);
    case "corpus:import":
      return runImportCommand(command);
    case "crawl":
      return runCrawlCommand(command, env);
  }
}

const entryPoint = process.argv[1];
if (entryPoint !== undefined && import.meta.url === pathToFileURL(entryPoint).href) {
  main().then((code) => {
    process.exitCode = code;
  });
}
