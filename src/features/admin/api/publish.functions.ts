/**
 * Compiles approved workbench words into the catalog the feed serves.
 *
 * This is the gate between an edit and a reader: only `approved` words are compiled,
 * the whole deck must pass `normalizeDeck` before anything is written, and the file
 * lands via an atomic rename, so a rejected deck leaves the previous catalog intact.
 *
 * The revision is a sha256 of the compiled content, matching scripts/import-vocabulary.ts,
 * so an identical recompile produces an identical revision and the feed's cached
 * permutations stay valid.
 *
 * Reaching readers still needs a deploy — the served catalog is bundled at build time.
 *
 * Exports: publishCatalog
 * Depends on: @tanstack/react-start, node:fs/promises, node:crypto, zod, admin gates
 */

import { createServerFn } from "@tanstack/react-start";
import { createHash, randomUUID } from "node:crypto";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { normalizeDeck } from "@/features/vocabulary/lib/schema";
import { toCatalogWord } from "@/features/vocabulary/lib/workbench";
import { readWorkbench, workbenchWritable } from "@/features/vocabulary/api/workbench-store.server";
import { requireAdminAccess } from "../lib/admin-access";
import { requireAdminContext } from "../lib/require-admin";
import { publishedCatalogWords } from "./workbench-rows.server";

const CATALOG_PATH = resolve(process.cwd(), "src/features/vocabulary/data/catalog.json");

export type PublishResult = {
  /** Words that would be, or were, written to the served catalog. */
  publishing: number;
  /** Words held back because they are not approved, by status. */
  skipped: Record<string, number>;
  /** Approved words whose text differs from what is currently served. */
  changed: number;
  revision: string;
  /** The revision already on disk, so an unchanged publish is visible as such. */
  previousRevision: string;
  written: boolean;
};

/**
 * Compile the approved words, optionally without writing.
 */
export const publishCatalog = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input: unknown) =>
    z.object({ dryRun: z.boolean().default(true) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<PublishResult> => {
    await requireAdminContext({ authUserId: context.userId });

    const words = await readWorkbench();
    const approved = words.filter((word) => word.status === "approved");
    if (!approved.length) {
      throw new Error("Nothing is approved yet — approve at least one word before publishing.");
    }

    const skipped: Record<string, number> = {};
    for (const word of words) {
      if (word.status !== "approved") skipped[word.status] = (skipped[word.status] ?? 0) + 1;
    }

    const previous = JSON.parse(await readFile(CATALOG_PATH, "utf8").catch(() => "{}")) as {
      revision?: string;
      name?: string;
    };

    // normalizeDeck throws on a duplicate id, a leaked answer or a malformed field, so a
    // deck that cannot be served is never written.
    const compiled = normalizeDeck({
      meta: { name: previous.name || "WordCrawler vocabulary" },
      words: approved.map(toCatalogWord),
    });
    const revision = createHash("sha256")
      .update(JSON.stringify(compiled))
      .digest("hex")
      .slice(0, 24);

    const served = await publishedCatalogWords();
    const changed = approved.filter((word) => !served.has(word.id)).length;

    if (data.dryRun) {
      return {
        publishing: compiled.count,
        skipped,
        changed,
        revision,
        previousRevision: previous.revision ?? "",
        written: false,
      };
    }

    if (!(await workbenchWritable())) {
      throw new Error("This server cannot write the catalog — publish from a local dev server.");
    }

    const temporary = `${CATALOG_PATH}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, `${JSON.stringify({ revision, ...compiled }, null, 2)}\n`, "utf8");
      await rename(temporary, CATALOG_PATH);
    } catch (error) {
      await unlink(temporary).catch(() => undefined);
      throw error;
    }

    return {
      publishing: compiled.count,
      skipped,
      changed,
      revision,
      previousRevision: previous.revision ?? "",
      written: true,
    };
  });
