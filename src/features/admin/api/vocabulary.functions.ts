/**
 * Admin vocabulary CRUD server functions (local file-backed).
 *
 * Reads/writes src/features/vocabulary/data/catalog.json so the developer
 * can refine words locally before importing into the compiled catalog.
 * Flagged Vietnamese fields can be regenerated with the configured LLM
 * (Together AI or Anthropic Claude — see /admin/model).
 *
 * Exports: listVocabularyWords, updateVocabularyWord, markVocabularyWordDone,
 * getCompletedWordCount, regenerateVocabularyField
 * Depends on: fs/promises, path, zod, require-admin, llm.server
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAccess } from "../lib/admin-access";
import { requireAdminContext } from "../lib/require-admin";
import { llmChat, readLlmConfig, type LlmConfig } from "../lib/llm.server";
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
  .middleware([requireAdminAccess])
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
  .middleware([requireAdminAccess])
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

// ---------------------------------------------------------------------------
// LLM regeneration of a flagged Vietnamese field
// ---------------------------------------------------------------------------

type RegenField = "def_vi" | "lead_vi" | "anticipate_vi";

const REGEN_SPECS: Record<
  RegenField,
  { catalogKey: "defVi" | "leadVi" | "anticipateVi"; minW: number; maxW: number; maxCh: number; rules: string }
> = {
  def_vi: {
    catalogKey: "defVi",
    minW: 8,
    maxW: 11,
    maxCh: 140,
    rules:
      "ONE Vietnamese sentence defining the English word. It must be a definition: clear, direct, no riddles. " +
      "Never include the English word or any English word. Never wrap anything in quotes or parentheses. " +
      "Never write a circular definition (the word reused in its own definition).",
  },
  lead_vi: {
    catalogKey: "leadVi",
    minW: 8,
    maxW: 11,
    maxCh: 120,
    rules:
      "A Vietnamese riddle-style teaser that hints at the meaning WITHOUT naming it directly. " +
      "Never include the English word or any English word. Never restate the definition. " +
      "Create curiosity — a picture or feeling, not an explanation.",
  },
  anticipate_vi: {
    catalogKey: "anticipateVi",
    minW: 3,
    maxW: 8,
    maxCh: 40,
    rules:
      "A very short playful Vietnamese invitation for the learner to guess the word before it is revealed. " +
      "Pure Vietnamese, fun and inviting (e.g. 'Đoán xem nào…'). Never state a fact.",
  },
};

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Call the configured LLM for one replacement phrase; retry once on rule failures. */
async function callLlmForPhrase(
  cfg: LlmConfig,
  field: RegenField,
  ctx: { english: string; level?: string; topic: string; current: string; complaints: string[]; otherFields: string },
): Promise<{ phrase: string; emphasis: string[] }> {
  const spec = REGEN_SPECS[field];
  const wantsEmphasis = field !== "anticipate_vi";
  const basePrompt = [
    `Write a replacement for the "${field}" field of a Vietnamese vocabulary card for the English word "${ctx.english}".`,
    "",
    `Field rules: ${spec.rules}`,
    `Length: exactly ${spec.minW}–${spec.maxW} Vietnamese words (space-separated syllables), max ${spec.maxCh} characters.`,
    `The learner's level is ${ctx.level ?? "B1"}, topic ${ctx.topic ?? "general"}.`,
    "",
    `Current version (rejected): "${ctx.current}"`,
    `Reviewer complaints: ${ctx.complaints.join("; ")}`,
    ctx.otherFields ? `Other fields on this card (do NOT copy them): ${ctx.otherFields}` : "",
    wantsEmphasis
      ? "Mark the 1–2 short spoken phrases (2–3 syllables each) worth highlighting by wrapping them in *asterisks*."
      : "",
    "",
    "Fix every complaint. Reply with ONLY the new Vietnamese phrase — no quotes, no explanations.",
  ]
    .filter(Boolean)
    .join("\n");

  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const textBlock = await llmChat(cfg, {
      system:
        "You write Vietnamese vocabulary card fields for a mobile learning app. " +
        "Output natural, idiomatic Vietnamese with full diacritics — the way a young Vietnamese speaker would phrase it. " +
        "Never mix in English words.",
      user:
        attempt === 0
          ? basePrompt
          : `${basePrompt}\n\n(Previous attempt failed validation: ${lastError}. Try a completely different phrasing.)`,
      maxTokens: 128,
      temperature: attempt === 0 ? 0.8 : 1,
    });

    // Pull *highlighted* marks before stripping them from the sentence.
    const emphasis = [...textBlock.matchAll(/\*([^*\n]+)\*/g)].map((m) => m[1]!.trim()).slice(0, 2);
    const phrase = textBlock
      .replace(/\*([^*\n]+)\*/g, "$1")
      .trim()
      .split("\n")[0]!
      .replace(/^["'\u201c\u201d]+|["'\u201c\u201d.]+$/g, "")
      .trim();

    const wc = wordCount(phrase);
    if (!phrase) { lastError = "empty response"; continue; }
    if (wc < spec.minW || wc > spec.maxW) { lastError = `${wc} words, need ${spec.minW}-${spec.maxW}`; continue; }
    if (phrase.length > spec.maxCh) { lastError = `${phrase.length} chars, max ${spec.maxCh}`; continue; }
    if (new RegExp(`\\b${ctx.english}\\b`, "i").test(phrase)) { lastError = `contains the English word "${ctx.english}"`; continue; }
    // Keep only marks that actually occur verbatim (case-sensitive) in the sentence.
    const validEmphasis = emphasis.filter((p) => phrase.includes(p) && wordCount(p) >= 2 && wordCount(p) <= 3);
    return { phrase, emphasis: wantsEmphasis ? validEmphasis : [] };
  }
  throw new Error(`LLM output kept failing rules (${lastError}). Edit the cell manually instead.`);
}

/**
 * Regenerate one flagged Vietnamese field with the configured LLM and save it
 * to catalog.json.
 */
export const regenerateVocabularyField = createServerFn({ method: "POST" })
  .middleware([requireAdminAccess])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().min(1),
        field: z.enum(["def_vi", "lead_vi", "anticipate_vi"]),
        complaints: z.array(z.string().min(2).max(48)).min(1).max(5),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdminContext({ authUserId: context.userId });

    const cfg = await readLlmConfig();
    if (!cfg) {
      throw new Error("No LLM key configured — add one on the Model page (/admin/model).");
    }

    const catalog = await readCatalog();
    const word = catalog.words.find((w) => w.id === data.id);
    if (!word) throw new Error(`Word "${data.id}" not found in catalog`);

    const spec = REGEN_SPECS[data.field];
    // Show the sibling fields so Claude differentiates, but not the rejected one.
    const otherFields = [
      data.field !== "def_vi" && word.defVi ? `definition: "${word.defVi}"` : "",
      data.field !== "lead_vi" && word.leadVi ? `lead: "${word.leadVi}"` : "",
      data.field !== "anticipate_vi" && word.anticipateVi ? `teaser: "${word.anticipateVi}"` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    const result = await callLlmForPhrase(cfg, data.field, {
      english: word.word,
      level: word.level,
      topic: word.topic ?? "general",
      current: word[spec.catalogKey] ?? "",
      complaints: data.complaints,
      otherFields,
    });

    word[spec.catalogKey] = result.phrase;

    // Emphasis phrases must exist verbatim in defVi+leadVi — keep marks from the
    // rewrite plus any old phrases that still match, so the renderer never
    // glows a missing phrase.
    if (data.field !== "anticipate_vi") {
      const combined = `${word.defVi ?? ""} ${word.leadVi ?? ""}`;
      const kept = (word.emphasis ?? []).filter((p) => combined.includes(p));
      word.emphasis = [...new Set([...result.emphasis, ...kept])].filter((p) => combined.includes(p)).slice(0, 3);
    }

    catalog.revision = Date.now().toString(36);
    await writeFile(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n", "utf-8");

    return { ok: true, value: result.phrase, emphasis: word.emphasis ?? [] };
  });
