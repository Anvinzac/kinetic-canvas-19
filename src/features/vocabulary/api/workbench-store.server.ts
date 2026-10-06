/**
 * Where the review workbench keeps its words: one NDJSON line per word.
 *
 * NDJSON rather than one JSON document because this file is committed — a reviewer
 * flipping one word's status should be a one-line diff, not a rewrite of every word.
 *
 * Writes are serialised through a queue and land via an atomic temp-file rename, so
 * two edits arriving together cannot each read the file, add themselves and overwrite
 * the other. Reads are cached until the file's mtime or size changes.
 *
 * This only works where the filesystem is writable, which means local development:
 * the deployed build runs on Cloudflare Workers and has no writable disk. Callers
 * check `workbenchWritable()` and show a read-only surface rather than offering
 * buttons that throw.
 *
 * Exports: WORKBENCH_PATH, workbenchExists, workbenchWritable, readWorkbench,
 *   replaceWorkbench, mutateWorkbench
 * Depends on: node:fs/promises, node:crypto, ../lib/workbench
 */

import { randomUUID } from "node:crypto";
import { access, constants, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { workbenchWordSchema, type WorkbenchWord } from "../lib/workbench";

export const WORKBENCH_PATH = resolve(
  process.cwd(),
  "src/features/vocabulary/data/workbench.ndjson",
);

/** Whether the store has been created yet. */
export async function workbenchExists(): Promise<boolean> {
  try {
    await access(WORKBENCH_PATH, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether this server may write the store at all.
 * @returns False on a read-only or absent filesystem, such as a Workers deployment
 */
export async function workbenchWritable(): Promise<boolean> {
  try {
    await access(dirname(WORKBENCH_PATH), constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

// ── Read, cached on mtime ────────────────────────────────────────────────────

let cache: { words: WorkbenchWord[]; mtimeMs: number; size: number } | null = null;

function parseLines(text: string): { words: WorkbenchWord[]; bad: number } {
  const words: WorkbenchWord[] = [];
  let bad = 0;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parsed = workbenchWordSchema.safeParse(JSON.parse(trimmed));
    // One unreadable line must not cost the whole store; it is counted and skipped.
    if (parsed.success) words.push(parsed.data);
    else bad += 1;
  }
  return { words, bad };
}

/**
 * Every authoring record, in file order.
 * @returns The stored words, or an empty list when the store does not exist yet
 */
export async function readWorkbench(): Promise<WorkbenchWord[]> {
  let info;
  try {
    info = await stat(WORKBENCH_PATH);
  } catch {
    return [];
  }
  if (cache && cache.mtimeMs === info.mtimeMs && cache.size === info.size) return cache.words;
  const { words } = parseLines(await readFile(WORKBENCH_PATH, "utf8"));
  cache = { words, mtimeMs: info.mtimeMs, size: info.size };
  return words;
}

// ── Write, serialised ────────────────────────────────────────────────────────

let queue: Promise<unknown> = Promise.resolve();

/** Run write tasks one at a time, so a read-modify-write cannot interleave. */
function queued<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  queue = next.catch(() => undefined);
  return next;
}

async function writeAtomically(words: readonly WorkbenchWord[]): Promise<void> {
  const body = words.map((word) => JSON.stringify(word)).join("\n");
  const temporary = `${WORKBENCH_PATH}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${body}\n`, "utf8");
    await rename(temporary, WORKBENCH_PATH);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
  const info = await stat(WORKBENCH_PATH);
  cache = { words: [...words], mtimeMs: info.mtimeMs, size: info.size };
}

/**
 * Overwrite the whole store. Used by the one-time migration.
 * @param words - the complete new contents
 */
export async function replaceWorkbench(words: readonly WorkbenchWord[]): Promise<void> {
  return queued(() => writeAtomically(words));
}

/**
 * Read, change and write the store as one indivisible step.
 * @param change - receives the current words and returns the new words plus a result
 * @returns Whatever `change` chose to report back
 */
export async function mutateWorkbench<T>(
  change: (words: WorkbenchWord[]) => { words: WorkbenchWord[]; result: T },
): Promise<T> {
  return queued(async () => {
    // Read inside the queue: a value fetched before waiting could already be stale.
    const { words, result } = change(await readWorkbench());
    await writeAtomically(words);
    return result;
  });
}
