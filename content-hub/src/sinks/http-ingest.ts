import type { ContentItem } from "../contract.ts";
import type { Logger } from "../logger.ts";
import type { DeliverResult, Sink } from "./types.ts";

// Alternative sink: POSTs each item to an app-owned ingestion endpoint (the
// `ingestAgentContent` seam) with an API key. Use this when you want the app to
// own validation/allowlisting, or to eventually move off Supabase entirely — the
// Hub then knows nothing but a URL and a key.
export class HttpIngestSink implements Sink {
  readonly name = "http-ingest";

  constructor(
    private readonly url: string,
    private readonly apiKey: string,
  ) {}

  async deliver(items: ContentItem[], log: Logger): Promise<DeliverResult> {
    let delivered = 0;
    let failed = 0;

    for (const item of items) {
      try {
        const res = await fetch(this.url, {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": this.apiKey },
          body: JSON.stringify({
            sourceKey: item.sourceKey,
            contentKey: item.contentKey,
            payload: item.payload,
            availableAt: item.availableAt,
          }),
        });
        if (!res.ok) {
          failed += 1;
          log.error("ingest failed", { contentKey: item.contentKey, status: res.status });
          continue;
        }
        delivered += 1;
        log.info("ingested", { sourceKey: item.sourceKey, contentKey: item.contentKey });
      } catch (err) {
        failed += 1;
        log.error("ingest error", { contentKey: item.contentKey, error: String(err) });
      }
    }

    return { delivered, failed };
  }
}
