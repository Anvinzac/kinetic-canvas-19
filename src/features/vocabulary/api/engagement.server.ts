/**
 * File-backed engagement counts (hearts / bookmarks) for the public feed.
 *
 * Mirrors the vocabulary catalog's local-first data model: totals live in
 * src/features/vocabulary/data/engagement.json, written atomically (tmp +
 * rename) so a failed write never corrupts existing counts.
 *
 * Exports: engagementGetResponse, engagementPostResponse
 * Depends on: node:fs/promises, zod
 */

import { randomBytes } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";

export type EngagementCounts = { hearts: number; bookmarks: number };

const STORE_PATH = resolve(process.cwd(), "src/features/vocabulary/data/engagement.json");

const COUNT_CAP = 1_000_000;

const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
const kindSchema = z.enum(["heart", "bookmark"]);
const actionSchema = z.enum(["add", "remove"]);

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

let cache: Record<string, EngagementCounts> | null = null;

/** Load counts once per process; a missing file simply means an all-zero store. */
async function loadStore(): Promise<Record<string, EngagementCounts>> {
  if (cache) return cache;
  try {
    const raw = JSON.parse(await readFile(STORE_PATH, "utf8"));
    const parsed = z
      .record(
        idSchema,
        z.object({
          hearts: z.number().int().min(0).max(COUNT_CAP),
          bookmarks: z.number().int().min(0).max(COUNT_CAP),
        }),
      )
      .parse(raw);
    cache = parsed;
  } catch {
    cache = {};
  }
  return cache;
}

/** Persist atomically via tmp + rename, keeping the in-memory cache in sync. */
async function saveStore(store: Record<string, EngagementCounts>): Promise<void> {
  const tmp = `${STORE_PATH}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(tmp, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  await rename(tmp, STORE_PATH);
  cache = store;
}

const fieldForKind = { heart: "hearts", bookmark: "bookmarks" } as const;

/**
 * GET /api/public/engagement?ids=a,b,c — batched totals for the given words.
 * @param request Incoming GET. @returns JSON { counts: { id: {hearts, bookmarks} } }.
 */
export async function engagementGetResponse(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const idsRaw = url.searchParams.get("ids") ?? "";
  const ids = [...new Set(idsRaw.split(",").filter(Boolean))].slice(0, 40);
  const invalid = ids.find((id) => !idSchema.safeParse(id).success);
  if (ids.length === 0 || invalid) {
    return Response.json(
      { code: "INVALID_REQUEST", error: "Valid word ids are required" },
      { status: 400, headers },
    );
  }
  const store = await loadStore();
  const counts: Record<string, EngagementCounts> = {};
  for (const id of ids) {
    counts[id] = store[id] ?? { hearts: 0, bookmarks: 0 };
  }
  return Response.json({ counts }, { headers });
}

/**
 * POST /api/public/engagement — one tap: { id, kind: heart|bookmark, action: add|remove }.
 * Counts are clamped at zero and a cap so the file stays sane for anonymous traffic.
 * @param request Incoming POST. @returns JSON { ok, count } with the authoritative total.
 */
export async function engagementPostResponse(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { code: "INVALID_REQUEST", error: "Body must be JSON" },
      { status: 400, headers },
    );
  }
  const parsed = z.object({ id: idSchema, kind: kindSchema, action: actionSchema }).safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { code: "INVALID_REQUEST", error: "Invalid engagement request" },
      { status: 400, headers },
    );
  }
  const { id, kind, action } = parsed.data;

  // Guard against stale cached totals racing a concurrent admin edit of the file.
  const store = { ...(await loadStore()) };
  const current = store[id] ?? { hearts: 0, bookmarks: 0 };
  const field = fieldForKind[kind];
  const nextValue = Math.min(COUNT_CAP, Math.max(0, current[field] + (action === "add" ? 1 : -1)));
  const next = { ...current, [field]: nextValue };
  store[id] = next;
  try {
    await saveStore(store);
  } catch {
    return Response.json(
      { code: "UNAVAILABLE", error: "Could not save. Please retry." },
      { status: 503, headers },
    );
  }
  return Response.json({ ok: true, count: next }, { headers });
}
