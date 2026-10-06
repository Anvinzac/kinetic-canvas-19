/**
 * The authoring record behind the review workbench, and the pure rules that turn
 * it into a published catalog word.
 *
 * A workbench word is a catalog word plus the state a reviewer needs: where it sits
 * in the pipeline, which usage domains and exam targets it was tagged with, and when
 * it last changed. Only `approved` words are compiled into the served catalog, so the
 * pipeline is the gate between an edit and a reader.
 *
 * Exports: WORKBENCH_STATUSES, WorkbenchStatus, WORKBENCH_STATUS_IDS, getWorkbenchStatus,
 *   WorkbenchWord, workbenchWordSchema, fromCatalogWord, toCatalogWord, publishedFingerprint
 * Depends on: zod, ./schema, ./taxonomy
 */

import { z } from "zod";
import { LEVELS, type VocabularyWord } from "./schema";
import { EXAM_IDS, TOPIC_IDS } from "./taxonomy";

/** Pipeline stages, in the order a word moves through them. */
export const WORKBENCH_STATUSES = [
  { id: "draft", vi: "Nháp", en: "Draft", hint: "Straight off the crawler, unread" },
  { id: "needs-review", vi: "Cần soát", en: "Needs review", hint: "Flagged for a closer look" },
  { id: "approved", vi: "Đã duyệt", en: "Approved", hint: "Compiled into the served catalog" },
  { id: "rejected", vi: "Loại", en: "Rejected", hint: "Never published; kept for the record" },
] as const;

export type WorkbenchStatus = (typeof WORKBENCH_STATUSES)[number]["id"];

export const WORKBENCH_STATUS_IDS = WORKBENCH_STATUSES.map((status) => status.id) as [
  WorkbenchStatus,
  ...WorkbenchStatus[],
];

/**
 * Look a pipeline stage up by id.
 * @param id - candidate status slug
 * @returns The stage, or undefined for an unknown slug
 * @pure true
 */
export function getWorkbenchStatus(id: string) {
  return WORKBENCH_STATUSES.find((status) => status.id === id);
}

/** One line of the workbench store. */
export const workbenchWordSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-zA-Z0-9_-]+$/),
  word: z.string().trim().min(2).max(64),
  defVi: z.string().trim().max(400).default(""),
  leadVi: z.string().trim().max(240).default(""),
  anticipateVi: z.string().trim().max(180).default(""),
  pos: z.string().trim().max(40).default(""),
  ipa: z.string().trim().max(120).default(""),
  level: z.enum(LEVELS).nullable().default(null),
  topics: z.array(z.enum(TOPIC_IDS)).max(6).default([]),
  exams: z.array(z.enum(EXAM_IDS)).max(7).default([]),
  emphasis: z.array(z.string().trim().min(1).max(80)).max(6).default([]),
  usage: z
    .array(z.object({ en: z.string().trim().max(400), vi: z.string().trim().max(400).default("") }))
    .max(5)
    .default([]),
  status: z.enum(WORKBENCH_STATUS_IDS).default("draft"),
  updatedAt: z.string().min(1),
  reviewedAt: z.string().nullable().default(null),
  reviewNote: z.string().trim().max(400).default(""),
});

export type WorkbenchWord = z.infer<typeof workbenchWordSchema>;

/**
 * Build an authoring record from a word already in the published catalog.
 *
 * Anything already served is treated as `approved`, because that is what being in
 * the catalog means; the single legacy `topic` slug becomes the first entry of the
 * multi-valued axis.
 * @param word - a published catalog word
 * @param at - ISO timestamp to stamp as the record's last change
 * @returns The authoring record
 * @pure true
 */
export function fromCatalogWord(word: VocabularyWord, at: string): WorkbenchWord {
  return workbenchWordSchema.parse({
    id: word.id,
    word: word.word,
    defVi: word.defVi,
    leadVi: word.leadVi,
    anticipateVi: word.anticipateVi,
    pos: word.pos,
    ipa: word.ipa,
    level: word.level ?? null,
    // A slug outside the curated set is dropped rather than smuggled in; the reviewer
    // re-tags it, and the migration report names every word this happened to.
    topics: (word.topics ?? [word.topic]).filter((topic) =>
      (TOPIC_IDS as readonly string[]).includes(topic),
    ),
    exams: (word.exams ?? []).filter((exam) => (EXAM_IDS as readonly string[]).includes(exam)),
    emphasis: word.emphasis ?? [],
    usage: word.usage ?? [],
    status: "approved",
    updatedAt: at,
    reviewedAt: null,
    reviewNote: "",
  });
}

/**
 * Strip the authoring fields back off, producing deck input for `normalizeDeck`.
 *
 * `topic` is carried as the first topic so the feed's existing single-value filter and
 * the check scripts keep working while `topics` is the canonical axis.
 * @param word - an approved authoring record
 * @returns Deck-shaped word
 * @pure true
 */
export function toCatalogWord(word: WorkbenchWord) {
  return {
    id: word.id,
    word: word.word,
    defVi: word.defVi,
    leadVi: word.leadVi,
    anticipateVi: word.anticipateVi,
    pos: word.pos,
    ipa: word.ipa,
    ...(word.level ? { level: word.level } : {}),
    topic: word.topics[0] ?? "general",
    topics: word.topics,
    exams: word.exams,
    ...(word.emphasis.length ? { emphasis: word.emphasis } : {}),
    usage: word.usage,
  };
}

/**
 * The reader-visible content of a word, as a stable string.
 *
 * Comparing an authoring record's fingerprint against the published catalog's is how
 * "edited since publish" is answered, so no drift flag has to be stored and kept true.
 * @param word - authoring record or published catalog word
 * @returns Canonical fingerprint of the published fields
 * @pure true
 */
export function publishedFingerprint(word: {
  word: string;
  defVi: string;
  leadVi?: string;
  anticipateVi?: string;
  pos?: string;
  ipa?: string;
  level?: string | null;
  topic?: string;
  topics?: readonly string[];
  exams?: readonly string[];
  emphasis?: readonly string[];
  usage?: readonly { en: string; vi?: string }[];
}): string {
  return JSON.stringify([
    word.word,
    word.defVi,
    word.leadVi ?? "",
    word.anticipateVi ?? "",
    word.pos ?? "",
    word.ipa ?? "",
    word.level ?? null,
    [...(word.topics ?? (word.topic ? [word.topic] : []))].sort(),
    [...(word.exams ?? [])].sort(),
    word.emphasis ?? [],
    (word.usage ?? []).map((entry) => [entry.en, entry.vi ?? ""]),
  ]);
}
