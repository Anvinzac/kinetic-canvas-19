/**
 * One sliding-window rate limiter for every public endpoint.
 *
 * This is the limiter that used to live inside word-report.server.ts, lifted out unchanged
 * so the other public routes can share it. It was written there, applied there, and four
 * sibling endpoints never got one — including the unauthenticated telemetry POST, which
 * writes through the service-role key. A limit that has to be remembered per endpoint is a
 * limit the next endpoint will not have.
 *
 * Privacy: the caller's address is ONLY ever a key in the in-memory map below. It is never
 * stored, never logged, and never leaves this module. (Where a caller has to be counted
 * across requests for longer than a window — the word-block rule — that uses a salted
 * digest instead; see reporter-digest.server.ts.)
 *
 * Limits of the approach, stated because they decide what this is good for: the window
 * lives in one process's memory, so with more than one instance the real budget is
 * `limit × instances`, and a cold start forgets everything. That is fine for holding off
 * casual abuse and accidental retry storms, which is what these endpoints need. It is NOT
 * a budget you can prove, so anything that must hold exactly — a spend cap, a quota —
 * belongs in Postgres where every instance can see the same counter.
 *
 * Exports: RATE_LIMITS, callerKey, checkRateLimit, rateLimitedResponse, resetRateLimits
 * Depends on: none (leaf module)
 */

/** A budget: how many requests one caller may make to one bucket per window. */
export type RateLimit = { limit: number; windowMs: number };

const MINUTE = 60 * 1000;

/**
 * Per-endpoint budgets, keyed by the pathname the middleware matches.
 *
 * They differ because the endpoints cost different things. A report is a deliberate human
 * act, so a dozen in ten minutes is already generous. Telemetry and engagement are fired
 * by the page itself, so their ceilings are set well above what an honest session produces
 * and are there to stop a flood, not to pace a reader. Refill is a daily cron call.
 */
export const RATE_LIMITS: Record<string, RateLimit> = {
  // A reader fixing a deck by hand might file a handful; a script files hundreds.
  "/api/public/word-report": { limit: 12, windowMs: 10 * MINUTE },
  // Unauthenticated AND writes through the service-role key, so this is the one that most
  // needs a ceiling: rows it accepts land in the tables the admin dashboards read.
  "/api/public/telemetry": { limit: 120, windowMs: MINUTE },
  // One tap each; a reader cannot out-tap this, a script can.
  "/api/public/engagement": { limit: 90, windowMs: MINUTE },
  // Paging the feed. Generous: a fast scroller legitimately pulls several pages a minute.
  "/api/public/vocabulary": { limit: 240, windowMs: MINUTE },
  // pg_cron calls this once a day. Anything beyond a retry or two is not the cron.
  "/api/public/vocabulary-refill": { limit: 10, windowMs: 10 * MINUTE },
};

/** Past this many tracked callers the map is swept of windows that have expired. */
const SWEEP_AT = 5000;

const hits = new Map<string, number[]>();

/**
 * The caller, as far as the edge will tell us.
 *
 * `local` is the placeholder when no forwarding header is present — a dev server, or a
 * deployment that does not front the app. Every such caller shares one key, which is the
 * safe direction for a limiter (it throttles harder) and the unsafe one for counting
 * distinct people, which is why the block rule refuses to count it.
 * @param request - the incoming request
 * @returns A key for the limiter's map; never stored anywhere else
 */
export function callerKey(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local"
  );
}

/**
 * Take one token from a caller's budget.
 * @param bucket - what is being limited, usually the pathname
 * @param key - the caller, from callerKey
 * @param budget - how many per window
 * @returns Whether the request may proceed, and when the window frees up if not
 */
export function checkRateLimit(
  bucket: string,
  key: string,
  budget: RateLimit,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const id = `${bucket}|${key}`;
  const recent = (hits.get(id) ?? []).filter((time) => now - time < budget.windowMs);
  if (recent.length >= budget.limit) {
    hits.set(id, recent);
    const oldest = recent[0] ?? now;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((budget.windowMs - (now - oldest)) / 1000)),
    };
  }
  recent.push(now);
  hits.set(id, recent);
  // Keep the map from growing without bound on a long-lived server.
  if (hits.size > SWEEP_AT) {
    for (const [entry, times] of hits) {
      if (!times.some((time) => now - time < budget.windowMs)) hits.delete(entry);
    }
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * The refusal every limited endpoint returns, so a caller sees one shape everywhere.
 * @param retryAfterSeconds - when the window frees up
 */
export function rateLimitedResponse(retryAfterSeconds: number): Response {
  return Response.json(
    { code: "RATE_LIMITED", error: "Too many requests. Try again shortly." },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}

/** Drop every window. For tests only. */
export function resetRateLimits(): void {
  hits.clear();
}
