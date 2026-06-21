import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";

// App-owned ingestion seam. The independent Content Hub delivers normalized items
// here (or straight to the Supabase RPC). This is the ONLY place that knows how to
// write into the queue, so validation, the source allowlist, and auth live in one
// spot — Supabase stays hidden behind it and can be swapped without touching the Hub.

// Sources the app is willing to accept. Mirrors public.agent_content_sources.
const ALLOWED_SOURCE_KEYS = new Set<string>(["vocabulary.en_vi"]);

const ingestItemSchema = z.object({
  sourceKey: z.string().min(1).max(64),
  contentKey: z.string().min(1).max(128),
  payload: z.record(z.string(), z.unknown()),
  availableAt: z.string().datetime().optional(),
});

export const ingestAgentContent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ingestItemSchema.parse(d))
  .handler(async ({ data }) => {
    assertValidApiKey();

    if (!ALLOWED_SOURCE_KEYS.has(data.sourceKey)) {
      throw new Error(`Unknown source_key: ${data.sourceKey}`);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: itemId, error } = await supabaseAdmin.rpc("enqueue_agent_content_item", {
      p_source_key: data.sourceKey,
      p_content_key: data.contentKey,
      p_payload: data.payload as unknown as Json,
      p_available_at: data.availableAt,
    });

    if (error) throw new Error(`enqueue_agent_content_item failed: ${error.message}`);
    return { id: itemId };
  });

function assertValidApiKey() {
  const expected = process.env.AGENT_INGEST_API_KEY ?? "";
  const provided = getRequest()?.headers.get("x-api-key") ?? "";
  if (!expected || !timingSafeEqual(provided, expected)) {
    throw new Error("Unauthorized: missing or invalid x-api-key");
  }
}

// Constant-time compare so a wrong key can't be discovered byte-by-byte via timing.
function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
