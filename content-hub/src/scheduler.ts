import cron from "node-cron";
import type { Logger } from "./logger.ts";
import type { Registry } from "./config.ts";
import { runSource } from "./runner.ts";

// Long-running "serve" mode: schedule every source on its own cron. For serverless
// hosts (Cloudflare Cron, GitHub Actions, Lambda) prefer the one-shot `run` command
// triggered by the platform's scheduler instead — same runSource() under the hood.
export function startScheduler(registry: Registry, log: Logger): void {
  for (const source of registry.sources) {
    if (!cron.validate(source.cron)) {
      log.error("invalid cron, skipping source", {
        sourceKey: source.adapter.sourceKey,
        cron: source.cron,
      });
      continue;
    }
    cron.schedule(
      source.cron,
      () => void runSource(source.adapter, registry.sink, source.batchSize, log),
      { timezone: "UTC" },
    );
    log.info("scheduled", {
      sourceKey: source.adapter.sourceKey,
      cron: source.cron,
      batchSize: source.batchSize,
    });
  }
  log.info("scheduler running — waiting for cron ticks");
}
