import type { Logger } from "./logger.ts";
import type { Sink } from "./sinks/types.ts";
import type { SourceAdapter } from "./sources/types.ts";

// Produce a batch from one source and deliver it. This is the unit of work that
// both the one-shot CLI and the scheduler call — keep all the logic here.
export async function runSource(
  adapter: SourceAdapter,
  sink: Sink,
  count: number,
  log: Logger,
): Promise<void> {
  const sourceLog = log.child(adapter.sourceKey);
  sourceLog.info("producing", { count });

  try {
    const items = await adapter.produce(count, { log: sourceLog });
    if (items.length === 0) {
      sourceLog.warn("nothing produced");
      return;
    }
    const result = await sink.deliver(items, sourceLog);
    sourceLog.info("run complete", {
      produced: items.length,
      delivered: result.delivered,
      failed: result.failed,
    });
  } catch (err) {
    sourceLog.error("run failed", { error: String(err) });
  }
}
