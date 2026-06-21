import type { ContentItem } from "../contract.ts";
import type { Logger } from "../logger.ts";
import type { DeliverResult, Sink } from "./types.ts";

// Default sink: calls the existing `enqueue_agent_content_item` RPC over PostgREST
// with the service-role key. The RPC upserts on (source_key, content_key), so
// delivery is idempotent. This is the only file in the Hub that knows Supabase
// exists — swap it for HttpIngestSink to remove that knowledge entirely.
export class SupabaseRpcSink implements Sink {
  readonly name = "supabase-rpc";
  private readonly endpoint: string;

  constructor(
    supabaseUrl: string,
    private readonly serviceRoleKey: string,
  ) {
    this.endpoint = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/enqueue_agent_content_item`;
  }

  async deliver(items: ContentItem[], log: Logger): Promise<DeliverResult> {
    let delivered = 0;
    let failed = 0;

    for (const item of items) {
      try {
        const res = await fetch(this.endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            apikey: this.serviceRoleKey,
            authorization: `Bearer ${this.serviceRoleKey}`,
          },
          body: JSON.stringify({
            p_source_key: item.sourceKey,
            p_content_key: item.contentKey,
            p_payload: item.payload,
            p_available_at: item.availableAt ?? null,
          }),
        });
        if (!res.ok) {
          failed += 1;
          log.error("enqueue failed", { contentKey: item.contentKey, status: res.status, body: await safeBody(res) });
          continue;
        }
        delivered += 1;
        log.info("enqueued", { sourceKey: item.sourceKey, contentKey: item.contentKey });
      } catch (err) {
        failed += 1;
        log.error("enqueue error", { contentKey: item.contentKey, error: String(err) });
      }
    }

    return { delivered, failed };
  }
}

async function safeBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return "<unreadable>";
  }
}
