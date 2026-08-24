import type { ContentItem } from "../contract.ts";
import type { Logger } from "../logger.ts";
import type { DeliverResult, Sink } from "./types.ts";

// Default sink: password-logs in as a system bot (profiles.is_system), then calls
// `enqueue_agent_content_item` over PostgREST with the user JWT + anon apikey.
// The RPC upserts on (source_key, content_key), so delivery is idempotent.
// This is the only file in the Hub that knows Supabase exists — swap it for
// HttpIngestSink to remove that knowledge entirely.
export class SupabaseRpcSink implements Sink {
  readonly name = "supabase-rpc";
  private readonly endpoint: string;
  private accessToken: string | null = null;
  private readonly authUrl: string;

  constructor(
    private readonly supabaseUrl: string,
    private readonly anonKey: string,
    private readonly email: string,
    private readonly password: string,
  ) {
    this.endpoint = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/enqueue_agent_content_item`;
    this.authUrl = `${supabaseUrl.replace(/\/$/, "")}/auth/v1/token?grant_type=password`;
  }

  private async getAccessToken(log: Logger): Promise<string | null> {
    if (this.accessToken) return this.accessToken;
    
    try {
      const res = await fetch(this.authUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: this.anonKey,
        },
        body: JSON.stringify({ email: this.email, password: this.password }),
      });
      if (!res.ok) {
        log.error("auth failed", { status: res.status, body: await safeBody(res) });
        return null;
      }
      const data = await res.json();
      this.accessToken = data.access_token;
      return this.accessToken;
    } catch (err) {
      log.error("auth error", { error: String(err) });
      return null;
    }
  }

  async deliver(items: ContentItem[], log: Logger): Promise<DeliverResult> {
    let delivered = 0;
    let failed = 0;

    if (items.length === 0) return { delivered, failed };

    const token = await this.getAccessToken(log);
    if (!token) {
      return { delivered: 0, failed: items.length };
    }

    for (const item of items) {
      try {
        const res = await fetch(this.endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            apikey: this.anonKey,
            authorization: `Bearer ${token}`,
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
