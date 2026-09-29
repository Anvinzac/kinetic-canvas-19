/**
 * Anonymous engagement totals client with a tiny per-word cache.
 *
 * Exports: EngagementCounts, loadEngagement, changeEngagement
 * Depends on: fetch only (no auth headers — the feed is public).
 */

import type { ReactionKind } from "../lib/reactions";

export type EngagementCounts = { hearts: number; bookmarks: number };

const cache = new Map<string, EngagementCounts>();
const inflight = new Map<string, Promise<EngagementCounts | null>>();

export function getCachedEngagement(id: string): EngagementCounts | null {
  return cache.get(id) ?? null;
}

/** Fetch totals for one word, deduplicated across cards. Resolves null on failure. */
export function loadEngagement(id: string): Promise<EngagementCounts | null> {
  const hit = cache.get(id);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(id);
  if (pending) return pending;
  const request = fetch(`/api/public/engagement?ids=${encodeURIComponent(id)}`, {
    credentials: "omit",
  })
    .then((response) => (response.ok ? response.json() : null))
    .then((body: { counts?: Record<string, EngagementCounts> } | null) => {
      const counts = body?.counts?.[id] ?? null;
      if (counts) cache.set(id, counts);
      return counts;
    })
    .catch(() => null)
    .finally(() => inflight.delete(id));
  inflight.set(id, request);
  return request;
}

/** Apply one tap server-side; resolves with the authoritative totals or null on failure. */
export async function changeEngagement(
  id: string,
  kind: ReactionKind,
  active: boolean,
): Promise<EngagementCounts | null> {
  try {
    const response = await fetch("/api/public/engagement", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "omit",
      body: JSON.stringify({ id, kind, action: active ? "add" : "remove" }),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { count?: EngagementCounts };
    if (!body.count) return null;
    cache.set(id, body.count);
    return body.count;
  } catch {
    return null;
  }
}
