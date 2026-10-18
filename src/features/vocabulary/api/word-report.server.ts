/**
 * Public endpoint for anonymous word reports.
 *
 * Exports: wordReportPostResponse
 * Depends on: ../lib/word-report schema, catalog.server, word-report-store.server
 */

import { wordReportSchema, toReportStage } from "../lib/word-report";
import { catalog } from "./catalog.server";
import { reporterDigest } from "./reporter-digest.server";
import { invalidateBlockedWordIds } from "./word-block.server";
import { addWordReport } from "./word-report-store.server";

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

/** A reader fixing a deck by hand might file a handful; a script files hundreds. */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 12;
const recent = new Map<string, number[]>();

/**
 * Sliding-window limit per caller. The address is only ever a key in this in-memory map.
 * It is not written to the report and not logged; what IS stored alongside the report is a
 * salted one-way digest of it (reporter-digest.server.ts), which exists solely so the block
 * rule can count separate readers.
 */
function allow(key: string): boolean {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) {
    recent.set(key, hits);
    return false;
  }
  hits.push(now);
  recent.set(key, hits);
  // Keep the map from growing without bound on a long-lived server.
  if (recent.size > 5000) {
    for (const [entry, times] of recent) {
      if (!times.some((time) => now - time < WINDOW_MS)) recent.delete(entry);
    }
  }
  return true;
}

function callerKey(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local"
  );
}

function refuse(status: number, code: string, error: string): Response {
  return Response.json({ code, error }, { status, headers });
}

/**
 * POST /api/public/word-report — { id, reasons[], stage? }.
 * Accepts only a known word and reasons from the fixed list; stores nothing about
 * who sent it.
 * @param request - incoming POST
 * @returns JSON { ok: true } or a refusal with a code
 */
export async function wordReportPostResponse(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return refuse(400, "INVALID_REQUEST", "Body must be JSON");
  }
  const parsed = wordReportSchema.safeParse(body);
  if (!parsed.success) return refuse(400, "INVALID_REQUEST", "Invalid report");

  // The FULL catalog on purpose: a word already blocked is still reportable, so the
  // reports keep accruing for the admin who will read them.
  const word = catalog.words.find((entry) => entry.id === parsed.data.id);
  if (!word) return refuse(404, "UNKNOWN_WORD", "That word is not in the catalog");
  const caller = callerKey(request);
  if (!allow(caller)) {
    return refuse(429, "RATE_LIMITED", "Too many reports. Try again later.");
  }

  try {
    await addWordReport({
      wordId: word.id,
      word: word.word,
      reasons: parsed.data.reasons,
      stage: toReportStage(parsed.data.stage ?? null),
      reporter: reporterDigest(caller, word.id),
    });
  } catch {
    return refuse(503, "UNAVAILABLE", "Could not save the report. Please retry.");
  }
  // This report may be the one that crosses the threshold; drop the cached blocklist so the
  // next page does not hand the reader back the word they just reported.
  invalidateBlockedWordIds();
  return Response.json({ ok: true }, { headers });
}
