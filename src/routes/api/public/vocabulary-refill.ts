import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Self-contained vocabulary producer.
//
// Replaces the external content-hub / GitHub Actions producer: the app server
// already holds the service role key and a Lovable AI key, so it can generate
// fresh words and enqueue them itself. pg_cron calls this endpoint daily with a
// token stored in public.internal_api_keys (single source of truth — no env
// secret has to be mirrored into an external CI system).

const wordSchema = z.object({
  word: z.string().min(2).max(32),
  viDefinition: z.string().min(4).max(200),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  nudge: z.string().min(2).max(140).optional(),
});

/**
 * The expected key, cached briefly in memory.
 *
 * The table stays the single source of truth; this only stops every ATTEMPT costing a
 * round trip to it. Before, an empty header was rejected for free but any junk value was
 * not: each one bought the sender a Supabase query, so a flood of garbage keys amplified
 * straight into database load on an endpoint nobody is supposed to be calling.
 *
 * The TTL is what bounds a rotation: a new key in the table takes effect within it.
 */
const KEY_TTL_MS = 60 * 1000;
let cachedKey: { secret: string; until: number } | null = null;

async function expectedKey(): Promise<string> {
  const now = Date.now();
  if (cachedKey && now < cachedKey.until) return cachedKey.secret;
  let secret = "";
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("internal_api_keys")
      .select("secret")
      .eq("name", "vocabulary_refill")
      .maybeSingle();
    secret = data?.secret ?? "";
  } catch {
    // Unreachable store: fall through with no key, which refuses the caller. Caching the
    // failure matters as much as caching a hit — an outage must not turn a flood of
    // attempts into a flood of retries against the thing that is already struggling.
    secret = "";
  }
  // A miss is cached too, for a shorter spell: if the row is absent, repeatedly asking
  // for it is exactly the amplification this is here to prevent.
  cachedKey = { secret, until: now + (secret ? KEY_TTL_MS : KEY_TTL_MS / 4) };
  return secret;
}

async function authorize(request: Request) {
  const provided = request.headers.get("x-ingest-key") ?? "";
  if (!provided) return null;
  const expected = await expectedKey();
  if (!expected || provided.length !== expected.length) return null;
  let mismatch = 0;
  for (let i = 0; i < provided.length; i += 1)
    mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  if (mismatch !== 0) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function generateWords(count: number, avoid: string[]) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-3-flash",
      messages: [
        {
          role: "system",
          content:
            "You generate English vocabulary for Vietnamese learners. Reply with ONLY a JSON array, no prose, no markdown fences.",
        },
        {
          role: "user",
          content:
            `Generate ${count} interesting but learnable single English words. ` +
            `Each element: { "word": string, "viDefinition": string (short natural Vietnamese definition, no English), ` +
            `"difficulty": "easy"|"medium"|"hard", "nudge": string (short playful Vietnamese hint) }. ` +
            `Avoid proper nouns, offensive words, and any of these already-used words: ${avoid.join(", ") || "(none)"}.`,
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`AI gateway ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = body.choices?.[0]?.message?.content ?? "[]";
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  const parsed: unknown = JSON.parse(
    start !== -1 && end > start ? text.slice(start, end + 1) : "[]",
  );
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((raw) => {
    const result = wordSchema.safeParse(raw);
    return result.success ? [result.data] : [];
  });
}

function countLetters(word: string) {
  return (word.match(/\p{L}/gu) ?? []).length;
}

export const Route = createFileRoute("/api/public/vocabulary-refill")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseAdmin = await authorize(request);
        if (!supabaseAdmin) return new Response("Unauthorized", { status: 401 });

        const url = new URL(request.url);
        const requested = Number.parseInt(url.searchParams.get("count") ?? "6", 10);
        const count = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 12) : 6;

        const { data: existing } = await supabaseAdmin
          .from("agent_content_items")
          .select("content_key")
          .eq("source_key", "vocabulary.en_vi")
          .order("created_at", { ascending: false })
          .limit(200);
        const known = new Set((existing ?? []).map((row) => row.content_key));

        let words;
        try {
          words = await generateWords(count, [...known].slice(0, 60));
        } catch (error) {
          return Response.json({ error: (error as Error).message }, { status: 502 });
        }

        const enqueued: string[] = [];
        for (const w of words) {
          const word = w.word.trim();
          const key = word.toLowerCase().replace(/\s+/g, " ");
          const letters = countLetters(word);
          if (letters < 2 || known.has(key)) continue;
          const { error } = await supabaseAdmin.rpc("enqueue_agent_content_item", {
            p_source_key: "vocabulary.en_vi",
            p_content_key: key,
            p_payload: {
              word,
              vi_definition: w.viDefinition.trim(),
              hints: [
                `Từ này bắt đầu bằng chữ ${word[0]!.toUpperCase()}.`,
                `Cả từ gồm ${letters} chữ cái.`,
                w.nudge?.trim() || "Đoán tiếp nào, bạn tìm ra chứ?",
              ],
              difficulty: w.difficulty ?? "medium",
            },
          });
          if (!error) {
            known.add(key);
            enqueued.push(key);
          }
        }

        return Response.json({ ok: true, enqueued: enqueued.length, words: enqueued });
      },
    },
  },
});
