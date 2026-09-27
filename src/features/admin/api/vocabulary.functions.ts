/**
 * Admin vocabulary CRUD server functions (local file-backed).
 *
 * Reads/writes src/features/vocabulary/data/catalog.json so the developer
 * can refine words locally before importing into the compiled catalog.
 *
 * Exports: listVocabularyWords, updateVocabularyWord
 * Depends on: fs/promises, path, zod, require-admin
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { requireAdminContext } from "../lib/require-admin";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const CATALOG_PATH = resolve(process.cwd(), "src/features/vocabulary/data/catalog.json");
const COMPLETED_PATH = resolve(process.cwd(), "src/features/vocabulary/data/completed.json");

export type VocabWordRow = {
  id: string;
  word: string;
  def_vi: string;
  lead_vi: string;
  anticipate_vi: string;
  pos: string;
  ipa: string;
  topic: string;
  level: string | null;
  emphasis: string[];
  usage_examples: Array<{ en: string; vi: string }>;
  updated_at: string;
};

type CatalogJson = {
  revision: string;
  name: string;
  count: number;
  topics: string[];
  levels: string[];
  words: Array<{
    id: string;
    word: string;
    defVi: string;
    leadVi: string;
    anticipateVi: string;
    pos: string;
    ipa: string;
    topic: string;
    level?: string;
    emphasis?: string[];
    usage?: Array<{ en: string; vi: string }>;
    chars?: number;
    initial?: string;
  }>;
};

async function readCatalog(): Promise<CatalogJson> {
  const raw = await readFile(CATALOG_PATH, "utf-8");
  return JSON.parse(raw) as CatalogJson;
}

function toRow(w: CatalogJson["words"][number]): VocabWordRow {
  return {
    id: w.id,
    word: w.word,
    def_vi: w.defVi,
    lead_vi: w.leadVi ?? "",
    anticipate_vi: w.anticipateVi ?? "",
    pos: w.pos ?? "",
    ipa: w.ipa ?? "",
    topic: w.topic ?? "general",
    level: w.level ?? null,
    emphasis: w.emphasis ?? [],
    usage_examples: w.usage ?? [],
    updated_at: "",
  };
}

/**
 * List all vocabulary words from the local catalog file.
 */
export const listVocabularyWords = createServerFn({ method: "GET" }).handler(
  async (): Promise<VocabWordRow[]> => {
    const catalog = await readCatalog();
    return catalog.words
      .map(toRow)
      .sort((a, b) => a.word.localeCompare(b.word));
  },
);

const updateSchema = z.object({
  id: z.string().min(1),
  word: z.string().trim().min(2).max(64).optional(),
  def_vi: z.string().trim().max(400).optional(),
  lead_vi: z.string().trim().max(240).optional(),
  anticipate_vi: z.string().trim().max(180).optional(),
  pos: z.string().trim().max(40).optional(),
  ipa: z.string().trim().max(120).optional(),
  topic: z.string().trim().max(60).optional(),
  level: z.string().nullable().optional(),
  usage_examples: z
    .array(z.object({ en: z.string(), vi: z.string() }))
    .max(5)
    .optional(),
});

/**
 * Update a single vocabulary word in the local catalog file.
 */
export const updateVocabularyWord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdminContext({ authUserId: context.userId });

    const { id, ...fields } = data;
    const catalog = await readCatalog();
    const index = catalog.words.findIndex((w) => w.id === id);
    if (index < 0) throw new Error(`Word "${id}" not found in catalog`);

    const word = catalog.words[index]!;
    // Map snake_case UI fields back to catalog camelCase fields.
    if (fields.word !== undefined) word.word = fields.word;
    if (fields.def_vi !== undefined) word.defVi = fields.def_vi;
    if (fields.lead_vi !== undefined) word.leadVi = fields.lead_vi;
    if (fields.anticipate_vi !== undefined) word.anticipateVi = fields.anticipate_vi;
    if (fields.pos !== undefined) word.pos = fields.pos;
    if (fields.ipa !== undefined) word.ipa = fields.ipa;
    if (fields.topic !== undefined) word.topic = fields.topic;
    if (fields.level !== undefined) {
      if (fields.level === null) {
        delete word.level;
      } else {
        word.level = fields.level;
      }
    }
    if (fields.usage_examples !== undefined) word.usage = fields.usage_examples;

    // Recompute derived fields.
    word.chars = (word.word.match(/\p{L}/gu) ?? []).length;
    word.initial = word.word[0]?.toUpperCase() ?? "";

    // Bump revision so the feed endpoint picks up changes on next server restart.
    catalog.revision = Date.now().toString(36);
    catalog.count = catalog.words.length;
    catalog.topics = [...new Set(catalog.words.map((w) => w.topic ?? "general"))].sort();
    catalog.levels = ["A1", "A2", "B1", "B2", "C1", "C2"].filter((l) =>
      catalog.words.some((w) => w.level === l),
    );

    await writeFile(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n", "utf-8");
    return { ok: true };
  });

type CompletedWord = CatalogJson["words"][number] & { completed_at: string };

async function readCompleted(): Promise<{ words: CompletedWord[] }> {
  try {
    const raw = await readFile(COMPLETED_PATH, "utf-8");
    return JSON.parse(raw) as { words: CompletedWord[] };
  } catch {
    return { words: [] };
  }
}

/**
 * Mark a word as done: moves it from catalog.json to completed.json.
 */
export const markVocabularyWordDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdminContext({ authUserId: context.userId });

    const catalog = await readCatalog();
    const index = catalog.words.findIndex((w) => w.id === data.id);
    if (index < 0) throw new Error(`Word "${data.id}" not found in catalog`);

    const [word] = catalog.words.splice(index, 1);

    // Recompute catalog metadata.
    catalog.revision = Date.now().toString(36);
    catalog.count = catalog.words.length;
    catalog.topics = [...new Set(catalog.words.map((w) => w.topic ?? "general"))].sort();
    catalog.levels = ["A1", "A2", "B1", "B2", "C1", "C2"].filter((l) =>
      catalog.words.some((w) => w.level === l),
    );

    // Append to completed staging file.
    const completed = await readCompleted();
    completed.words.push({ ...word!, completed_at: new Date().toISOString() });

    await Promise.all([
      writeFile(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n", "utf-8"),
      writeFile(COMPLETED_PATH, JSON.stringify(completed, null, 2) + "\n", "utf-8"),
    ]);

    return { ok: true, completedCount: completed.words.length };
  });

/**
 * Return the number of words marked as done.
 */
export const getCompletedWordCount = createServerFn({ method: "GET" }).handler(
  async (): Promise<number> => {
    const completed = await readCompleted();
    return completed.words.length;
  },
);
