/**
 * The live blocklist: which words the feed is currently holding back.
 *
 * Reading it is on the path that serves a reader their next page, so it is cached rather
 * than recomputed per request. Two things keep the cache honest:
 *   - a short TTL, so an admin resolving reports in another process is picked up without a
 *     deploy;
 *   - an explicit invalidation when THIS process stores a report, so the reader who tips a
 *     word over the threshold does not keep being served it.
 *
 * A refresh that fails leaves the previous list in place and lets the feed carry on. That
 * is the deliberate direction to fail in: the store being unreachable is not a reason to
 * stop serving words, and a block is provisional anyway.
 *
 * Exports: getBlockedWordIds, refreshBlockedWordIds, invalidateBlockedWordIds
 * Depends on: ../lib/word-block, ./word-report-store.server
 */

import { getBlockedWordIds as computeBlocked } from "../lib/word-block";
import { listWordReportSignals } from "./word-report-store.server";

/** How long a computed blocklist is reused before the store is asked again. */
const TTL_MS = 30_000;

let blocked: ReadonlySet<string> = new Set();
let freshUntil = 0;
/** In-flight refresh, so a burst of requests asks the store once. */
let inFlight: Promise<void> | null = null;

/** The list as it stands, without touching the store. @returns Blocked word ids */
export function getBlockedWordIds(): ReadonlySet<string> {
  return blocked;
}

/** Drop the cache so the next read recomputes; called when this process stores a report. */
export function invalidateBlockedWordIds(): void {
  freshUntil = 0;
}

/**
 * Bring the list up to date if it has gone stale.
 *
 * Awaited by the feed endpoint so the first request after a restart is already correct
 * rather than serving a word that should be hidden.
 * @returns Resolves when the list is fresh, or when a refresh has failed and the previous
 *   list stands
 */
export async function refreshBlockedWordIds(): Promise<void> {
  if (Date.now() < freshUntil) return;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      blocked = computeBlocked(await listWordReportSignals());
      freshUntil = Date.now() + TTL_MS;
    } catch {
      // Store unreachable: keep what we have and try again on the next request rather
      // than dropping every block or failing the page.
      freshUntil = Date.now() + TTL_MS / 3;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}
