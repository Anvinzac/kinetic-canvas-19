import { buildRegistry } from "./config.ts";
import { createLogger } from "./logger.ts";
import { runSource } from "./runner.ts";
import { startScheduler } from "./scheduler.ts";

// Two entry modes:
//   tsx src/cli.ts run [sourceKey] [count]   one-shot — for platform cron / manual
//   tsx src/cli.ts serve                     long-running scheduler (node-cron)
async function main() {
  const log = createLogger("hub");
  const [, , command, ...rest] = process.argv;
  const registry = buildRegistry(log);

  if (command === "serve") {
    startScheduler(registry, log);
    return; // node-cron keeps the event loop alive
  }

  if (command === "run") {
    const [sourceKeyArg, countArg] = rest;
    const targets = sourceKeyArg
      ? registry.sources.filter((s) => s.adapter.sourceKey === sourceKeyArg)
      : registry.sources;

    if (targets.length === 0) {
      log.error("no matching source", { sourceKey: sourceKeyArg });
      process.exitCode = 1;
      return;
    }

    for (const source of targets) {
      const count = countArg ? Number.parseInt(countArg, 10) : source.batchSize;
      await runSource(source.adapter, registry.sink, count, log);
    }
    return;
  }

  log.error("unknown command", { command, usage: "run [sourceKey] [count] | serve" });
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
