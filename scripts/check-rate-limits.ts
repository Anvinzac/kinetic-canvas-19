/**
 * Guard: every public endpoint has a rate limit, and the limiter actually refuses.
 *
 * The defect this exists for is not a broken limiter — it is a missing one. The app had a
 * working sliding window inside one endpoint and four public routes without any, including
 * an unauthenticated POST that writes with the service-role key. Nothing said so. A new
 * file under src/routes/api/public is now a failing check until it is given a budget.
 *
 * Run: npx tsx scripts/check-rate-limits.ts
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  RATE_LIMITS,
  callerKey,
  checkRateLimit,
  rateLimitedResponse,
  resetRateLimits,
} from "../src/lib/rate-limit";

const checks: string[] = [];
function check(label: string, passed: boolean, detail?: unknown) {
  checks.push(`${passed ? "OK  " : "FAIL"}  ${label}`);
  if (!passed) {
    process.exitCode = 1;
    if (detail !== undefined) console.error("      ", detail);
  }
}

// ── Every public route has a budget ─────────────────────────────────────────────────────
const ROUTES_DIR = "src/routes/api/public";
const routes = readdirSync(ROUTES_DIR)
  .filter((file) => file.endsWith(".ts"))
  .map((file) => `/api/public/${file.replace(/\.ts$/, "")}`);
assert.ok(routes.length > 0, "no public routes were read; this guard would pass vacuously");

for (const route of routes) {
  check(`${route} has a budget`, route in RATE_LIMITS, Object.keys(RATE_LIMITS));
}
// ... and no budget names a route that no longer exists.
for (const path of Object.keys(RATE_LIMITS)) {
  check(`${path} is still a real route`, routes.includes(path), routes);
}

// ── The limiter refuses, and only the caller who spent the budget ───────────────────────
{
  resetRateLimits();
  const budget = { limit: 3, windowMs: 60_000 };
  const verdicts = [1, 2, 3, 4].map(() => checkRateLimit("/t", "1.2.3.4", budget));
  check(
    "the first `limit` requests pass and the next is refused",
    verdicts.slice(0, 3).every((v) => v.allowed) && !verdicts[3]!.allowed,
    verdicts.map((v) => v.allowed),
  );
  check("a refusal says when to come back", verdicts[3]!.retryAfterSeconds > 0);
  check(
    "a different caller still has its own budget",
    checkRateLimit("/t", "5.6.7.8", budget).allowed,
  );
  check(
    "a different bucket still has its own budget",
    checkRateLimit("/other", "1.2.3.4", budget).allowed,
  );
}

// ── A spent window frees up again ───────────────────────────────────────────────────────
{
  resetRateLimits();
  const budget = { limit: 1, windowMs: 40 };
  check("first request passes", checkRateLimit("/w", "9.9.9.9", budget).allowed);
  check("second is refused inside the window", !checkRateLimit("/w", "9.9.9.9", budget).allowed);
  await new Promise((resolve) => setTimeout(resolve, 60));
  check("and passes once the window has rolled", checkRateLimit("/w", "9.9.9.9", budget).allowed);
}

// ── The caller key reads the headers the edge actually sets ─────────────────────────────
{
  const cf = new Request("https://x/", { headers: { "cf-connecting-ip": "203.0.113.7" } });
  const xff = new Request("https://x/", {
    headers: { "x-forwarded-for": "198.51.100.4, 10.0.0.1" },
  });
  check("cf-connecting-ip is used", callerKey(cf) === "203.0.113.7", callerKey(cf));
  check("the first x-forwarded-for hop is used", callerKey(xff) === "198.51.100.4", callerKey(xff));
  check("no header falls back to a shared key", callerKey(new Request("https://x/")) === "local");
}

// ── The refusal is a well-formed 429 ────────────────────────────────────────────────────
{
  const response = rateLimitedResponse(42);
  check("refusal is 429", response.status === 429);
  check("refusal carries Retry-After", response.headers.get("Retry-After") === "42");
  check("refusal is not cached", response.headers.get("Cache-Control") === "no-store");
}

// ── The endpoint no longer carries its own copy ─────────────────────────────────────────
{
  const source = readFileSync("src/features/vocabulary/api/word-report.server.ts", "utf8");
  check(
    "word-report does not re-implement the limiter",
    !/MAX_PER_WINDOW|const recent = new Map/.test(source),
  );
}

// ── The refill key check does not reach the database per attempt ────────────────────────
{
  const source = readFileSync("src/routes/api/public/vocabulary-refill.ts", "utf8");
  const authorizeBody = source.slice(source.indexOf("async function authorize"));
  const beforeCompare = authorizeBody.slice(0, authorizeBody.indexOf("mismatch"));
  check(
    "a wrong key is rejected without importing the admin client",
    !beforeCompare.includes("client.server"),
    "authorize() reaches Supabase before comparing the key",
  );
}

console.log(checks.join("\n"));
if (process.exitCode) console.error("\nrate limit guard FAILED");
else console.log(`\n${checks.length} rate-limit assertions passed`);
