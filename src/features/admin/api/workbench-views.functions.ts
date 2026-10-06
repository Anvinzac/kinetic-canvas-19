/**
 * Saved workbench queues — the "folders" of the review surface.
 *
 * A queue is not a container words are moved into: it is a named set of filter
 * parameters. "B2 words tagged TOEIC with two or more open reports" stays correct as
 * words are added and reports arrive, and nothing has to be re-filed by hand.
 *
 * Because the parameters are the same ones the page keeps in its URL, saving a queue
 * is storing a link and opening one is following it.
 *
 * Exports: listWorkbenchViews, saveWorkbenchView, deleteWorkbenchView, WorkbenchView
 * Depends on: @tanstack/react-start, node:fs/promises, node:crypto, zod, admin gates
 */

import { createServerFn } from "@tanstack/react-start";
import { randomUUID } from "node:crypto";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { requireAdminAccess } from "../lib/admin-access";
import { requireAdminContext } from "../lib/require-admin";

const VIEWS_PATH = resolve(process.cwd(), "src/features/vocabulary/data/views.json");
const MAX_VIEWS = 40;

export type WorkbenchView = {
  id: string;
  name: string;
  /** Filter parameters, exactly as the page keeps them in the URL. */
  params: Record<string, string>;
  createdAt: string;
};

const viewSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(60),
  params: z.record(z.string().max(40), z.string().max(240)),
  createdAt: z.string().min(1),
});

async function readViews(): Promise<WorkbenchView[]> {
  try {
    const parsed = JSON.parse(await readFile(VIEWS_PATH, "utf8")) as { views?: unknown[] };
    // A queue that no longer parses is dropped rather than failing the whole list.
    return (parsed.views ?? []).flatMap((view) => {
      const result = viewSchema.safeParse(view);
      return result.success ? [result.data] : [];
    });
  } catch {
    return [];
  }
}

let queue: Promise<unknown> = Promise.resolve();

async function writeViews(views: readonly WorkbenchView[]): Promise<void> {
  const task = async () => {
    const temporary = `${VIEWS_PATH}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, `${JSON.stringify({ views }, null, 2)}\n`, "utf8");
      await rename(temporary, VIEWS_PATH);
    } catch (error) {
      await unlink(temporary).catch(() => undefined);
      throw error;
    }
  };
  const next = queue.then(task, task);
  queue = next.catch(() => undefined);
  return next;
}

/** Every saved queue, newest first. */
export const listWorkbenchViews = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .handler(async ({ context }): Promise<WorkbenchView[]> => {
    await requireAdminContext({ authUserId: context.userId });
    return (await readViews()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

/** Save the current filters as a named queue, replacing one of the same name. */
export const saveWorkbenchView = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(60),
        params: z.record(z.string().max(40), z.string().max(240)),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<WorkbenchView> => {
    await requireAdminContext({ authUserId: context.userId });
    const views = await readViews();
    const view: WorkbenchView = {
      id: randomUUID(),
      name: data.name,
      params: data.params,
      createdAt: new Date().toISOString(),
    };
    const kept = views.filter(
      (existing) => existing.name.toLowerCase() !== data.name.toLowerCase(),
    );
    if (kept.length >= MAX_VIEWS) {
      throw new Error(`There are already ${MAX_VIEWS} saved queues — delete one first.`);
    }
    await writeViews([view, ...kept]);
    return view;
  });

/** Remove a saved queue. */
export const deleteWorkbenchView = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input: unknown) => z.object({ id: z.string().min(1).max(64) }).parse(input))
  .handler(async ({ data, context }): Promise<{ removed: number }> => {
    await requireAdminContext({ authUserId: context.userId });
    const views = await readViews();
    const kept = views.filter((view) => view.id !== data.id);
    if (kept.length !== views.length) await writeViews(kept);
    return { removed: views.length - kept.length };
  });
