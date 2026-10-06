/**
 * Write side of the vocabulary review workbench.
 *
 * Every mutation goes through the store's queue, so concurrent edits serialise instead
 * of overwriting each other, and a single-word edit additionally carries the timestamp
 * it was based on: a stale write is refused rather than silently clobbering a change
 * made in another tab.
 *
 * Bulk edits take either explicit ids or the query that selected them, so "apply to all
 * 240 matching" is one request and one file write rather than 240 of each.
 *
 * Exports: updateWorkbenchWord, bulkUpdateWorkbench, migrateWorkbench,
 *   regenerateWorkbenchField
 * Depends on: @tanstack/react-start, zod, admin gates, workbench store, workbench-filter
 */

import { createServerFn } from "@tanstack/react-start";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { LEVELS, normalizeDeck } from "@/features/vocabulary/lib/schema";
import { EXAM_IDS, TOPIC_IDS } from "@/features/vocabulary/lib/taxonomy";
import {
  WORKBENCH_STATUS_IDS,
  fromCatalogWord,
  workbenchWordSchema,
  type WorkbenchWord,
} from "@/features/vocabulary/lib/workbench";
import {
  mutateWorkbench,
  readWorkbench,
  replaceWorkbench,
  workbenchWritable,
} from "@/features/vocabulary/api/workbench-store.server";
import { requireAdminAccess } from "../lib/admin-access";
import { requireAdminContext } from "../lib/require-admin";
import { readLlmConfig } from "../lib/llm.server";
import { filterRows } from "../lib/workbench-filter";
import { REGEN_FIELDS, regeneratePhrase } from "./regenerate.server";
import { buildWorkbenchRows } from "./workbench-rows.server";
import { workbenchQuerySchema } from "./workbench.functions";

const CATALOG_PATH = resolve(process.cwd(), "src/features/vocabulary/data/catalog.json");
const COMPLETED_PATH = resolve(process.cwd(), "src/features/vocabulary/data/completed.json");

/** Refuse early with an explanation rather than throwing a bare filesystem error. */
async function assertWritable(): Promise<void> {
  if (await workbenchWritable()) return;
  throw new Error(
    "This server cannot write the workbench — it has no writable filesystem. " +
      "Review words with `npm run dev` locally, then publish and deploy.",
  );
}

const editableFields = z.object({
  word: z.string().trim().min(2).max(64).optional(),
  defVi: z.string().trim().max(400).optional(),
  leadVi: z.string().trim().max(240).optional(),
  anticipateVi: z.string().trim().max(180).optional(),
  pos: z.string().trim().max(40).optional(),
  ipa: z.string().trim().max(120).optional(),
  level: z.enum(LEVELS).nullable().optional(),
  topics: z.array(z.enum(TOPIC_IDS)).max(6).optional(),
  exams: z.array(z.enum(EXAM_IDS)).max(7).optional(),
  status: z.enum(WORKBENCH_STATUS_IDS).optional(),
  reviewNote: z.string().trim().max(400).optional(),
});

/**
 * Change one word, refusing the write if it was based on a stale copy.
 */
export const updateWorkbenchWord = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().min(1).max(80),
        fields: editableFields,
        /** The `updatedAt` the editor last saw; omit only for a deliberate overwrite. */
        expectedUpdatedAt: z.string().min(1).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ word: WorkbenchWord }> => {
    await requireAdminContext({ authUserId: context.userId });
    await assertWritable();
    return mutateWorkbench((words) => {
      const index = words.findIndex((word) => word.id === data.id);
      if (index < 0) throw new Error(`Word "${data.id}" is not in the workbench`);
      const current = words[index]!;
      if (data.expectedUpdatedAt && current.updatedAt !== data.expectedUpdatedAt) {
        throw new Error(
          "This word changed somewhere else since you opened it. Reload before editing again.",
        );
      }
      const now = new Date().toISOString();
      const next = workbenchWordSchema.parse({
        ...current,
        ...data.fields,
        updatedAt: now,
        // Moving out of a draft stamps the review; moving back to one clears it.
        reviewedAt:
          data.fields.status && data.fields.status !== "draft"
            ? now
            : data.fields.status === "draft"
              ? null
              : current.reviewedAt,
      });
      const updated = [...words];
      updated[index] = next;
      return { words: updated, result: { word: next } };
    });
  });

const bulkSet = z.object({
  status: z.enum(WORKBENCH_STATUS_IDS).optional(),
  addTopics: z.array(z.enum(TOPIC_IDS)).max(6).optional(),
  removeTopics: z.array(z.enum(TOPIC_IDS)).max(6).optional(),
  addExams: z.array(z.enum(EXAM_IDS)).max(7).optional(),
  removeExams: z.array(z.enum(EXAM_IDS)).max(7).optional(),
});

function applyBulk(word: WorkbenchWord, set: z.infer<typeof bulkSet>, now: string): WorkbenchWord {
  const topics = new Set(word.topics);
  for (const topic of set.addTopics ?? []) topics.add(topic);
  for (const topic of set.removeTopics ?? []) topics.delete(topic);
  const exams = new Set(word.exams);
  for (const exam of set.addExams ?? []) exams.add(exam);
  for (const exam of set.removeExams ?? []) exams.delete(exam);
  return workbenchWordSchema.parse({
    ...word,
    topics: [...topics],
    exams: [...exams],
    status: set.status ?? word.status,
    updatedAt: now,
    reviewedAt: set.status && set.status !== "draft" ? now : word.reviewedAt,
  });
}

/**
 * Apply one change to many words at once, selected by id or by the active query.
 */
export const bulkUpdateWorkbench = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input: unknown) =>
    z
      .object({
        ids: z.array(z.string().min(1).max(80)).max(20_000).optional(),
        /** Used instead of ids when the reviewer chose "select everything matching". */
        query: workbenchQuerySchema.partial().optional(),
        set: bulkSet,
      })
      .refine((value) => value.ids?.length || value.query, "Select words by id or by query")
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ changed: number }> => {
    await requireAdminContext({ authUserId: context.userId });
    await assertWritable();
    let ids = new Set(data.ids ?? []);
    if (!ids.size && data.query) {
      const query = workbenchQuerySchema.parse(data.query);
      ids = new Set(filterRows(await buildWorkbenchRows(), query).map((row) => row.id));
    }
    if (!ids.size) return { changed: 0 };
    const now = new Date().toISOString();
    return mutateWorkbench((words) => {
      let changed = 0;
      const updated = words.map((word) => {
        if (!ids.has(word.id)) return word;
        changed += 1;
        return applyBulk(word, data.set, now);
      });
      return { words: updated, result: { changed } };
    });
  });

type LegacyCompleted = { words?: { id: string }[] };

/**
 * Build the workbench once from the published catalog.
 *
 * Everything already served is `approved`, since that is what being in the catalog
 * means. `completed.json` is reported rather than interpreted: the old "Done" button
 * *removed* a word from the served catalog, so those words are listed for the reviewer
 * to place instead of being guessed into a status.
 */
export const migrateWorkbench = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input: unknown) =>
    z.object({ force: z.boolean().default(false) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireAdminContext({ authUserId: context.userId });
    await assertWritable();
    const existing = await readWorkbench();
    if (existing.length && !data.force) {
      throw new Error(
        `The workbench already holds ${existing.length} words. Pass force to rebuild it from the catalog.`,
      );
    }
    const catalog = normalizeDeck(JSON.parse(await readFile(CATALOG_PATH, "utf8")));
    const now = new Date().toISOString();
    const words = catalog.words.map((word) => fromCatalogWord(word, now));
    const untagged = words.filter((word) => !word.topics.length).map((word) => word.word);
    const retired = await readFile(COMPLETED_PATH, "utf8")
      .then((raw) => (JSON.parse(raw) as LegacyCompleted).words?.map((word) => word.id) ?? [])
      .catch(() => [] as string[]);
    await replaceWorkbench(words);
    return { imported: words.length, untagged, retired };
  });

/**
 * Replace one flagged Vietnamese field with an LLM rewrite.
 *
 * The model is called outside the store's write queue: a slow request must not hold up
 * every other edit, and the rewrite is only worth writing once it has passed validation.
 */
export const regenerateWorkbenchField = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().min(1).max(80),
        field: z.enum(REGEN_FIELDS),
        complaints: z.array(z.string().min(2).max(48)).min(1).max(5),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ word: WorkbenchWord }> => {
    await requireAdminContext({ authUserId: context.userId });
    await assertWritable();

    const config = await readLlmConfig();
    if (!config) {
      throw new Error("No LLM key configured — add one on the Model page (/admin/model).");
    }

    const word = (await readWorkbench()).find((entry) => entry.id === data.id);
    if (!word) throw new Error(`Word "${data.id}" is not in the workbench`);

    // Show the sibling fields so the model differentiates, but never the rejected one.
    const otherFields = [
      data.field !== "defVi" && word.defVi ? `definition: "${word.defVi}"` : "",
      data.field !== "leadVi" && word.leadVi ? `lead: "${word.leadVi}"` : "",
      data.field !== "anticipateVi" && word.anticipateVi ? `teaser: "${word.anticipateVi}"` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    const rewrite = await regeneratePhrase(config, data.field, {
      english: word.word,
      level: word.level,
      topic: word.topics[0] ?? "general",
      current: word[data.field],
      complaints: data.complaints,
      otherFields,
    });

    return mutateWorkbench((words) => {
      const index = words.findIndex((entry) => entry.id === data.id);
      if (index < 0) throw new Error(`Word "${data.id}" is not in the workbench`);
      const current = words[index]!;
      const next = { ...current, [data.field]: rewrite.phrase };
      // Emphasis must occur verbatim in the text that renders it, or the feed would glow
      // a phrase that is no longer there.
      const combined = `${next.defVi} ${next.leadVi}`;
      const parsed = workbenchWordSchema.parse({
        ...next,
        emphasis: [...new Set([...rewrite.emphasis, ...current.emphasis])]
          .filter((phrase) => combined.includes(phrase))
          .slice(0, 3),
        updatedAt: new Date().toISOString(),
      });
      const updated = [...words];
      updated[index] = parsed;
      return { words: updated, result: { word: parsed } };
    });
  });
