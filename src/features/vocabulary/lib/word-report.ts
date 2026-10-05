/**
 * The anonymous "something is wrong with this word" report: what a reader can say,
 * and the shape it travels in.
 *
 * A report is a word id, one or more reasons picked from a fixed list, and the page
 * of the card the reader was on. There is deliberately no free text and no reader
 * identifier, so a report cannot carry anything personal.
 *
 * Exports: REPORT_REASONS, ReportReasonId, REPORT_REASON_IDS, getReportReason,
 *   toReportStage, wordReportSchema, WordReportInput, WordReport, WordReportStatus,
 *   MAX_REPORT_REASONS
 * Depends on: zod
 */

import { z } from "zod";

/** Reasons a reader can tap, in the order they are offered. */
export const REPORT_REASONS = [
  { id: "meaning-wrong", vi: "Nghĩa bị sai", en: "Meaning is wrong" },
  { id: "clue-confusing", vi: "Gợi ý khó hiểu", en: "Clue is confusing" },
  { id: "clue-misleading", vi: "Gợi ý dẫn tới từ khác", en: "Clue points to another word" },
  { id: "example-wrong", vi: "Câu ví dụ sai", en: "Example sentence is wrong" },
  { id: "vietnamese-unnatural", vi: "Tiếng Việt gượng", en: "Vietnamese reads unnaturally" },
  { id: "typo", vi: "Lỗi chính tả", en: "Spelling mistake" },
  {
    id: "pronunciation-wrong",
    vi: "Phiên âm / từ loại sai",
    en: "Pronunciation or word class wrong",
  },
  { id: "level-mismatch", vi: "Sai độ khó", en: "Wrong difficulty level" },
] as const;

export type ReportReasonId = (typeof REPORT_REASONS)[number]["id"];

export const REPORT_REASON_IDS = REPORT_REASONS.map((reason) => reason.id) as [
  ReportReasonId,
  ...ReportReasonId[],
];

/** Look a reason up by id. @returns undefined for an id no longer offered. @pure true */
export function getReportReason(id: string) {
  return REPORT_REASONS.find((reason) => reason.id === id);
}

/** A reader may pick several, but not the whole list as a way of saying nothing. */
export const MAX_REPORT_REASONS = 4;

/** Pages of a card a report can be filed from. */
const REPORT_STAGES = [
  "lead",
  "definition",
  "letters",
  "usage",
  "anticipation",
  "reveal",
  "spelling",
] as const;
export type ReportStage = (typeof REPORT_STAGES)[number];

/**
 * Reduce a card's page id ("definition-1", "reveal") to the page kind.
 * @returns The kind, or null for anything unrecognised
 * @pure true
 */
export function toReportStage(stageId: string | null | undefined): ReportStage | null {
  const base = (stageId ?? "").replace(/-\d+$/, "");
  return (REPORT_STAGES as readonly string[]).includes(base) ? (base as ReportStage) : null;
}

/** What the public endpoint accepts. Anything outside it is refused, never stored. */
export const wordReportSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  reasons: z
    .array(z.enum(REPORT_REASON_IDS))
    .min(1)
    .max(MAX_REPORT_REASONS)
    .transform((reasons) => [...new Set(reasons)]),
  stage: z.enum(REPORT_STAGES).nullable().optional(),
});

export type WordReportInput = z.infer<typeof wordReportSchema>;

export type WordReportStatus = "new" | "resolved";

/** One stored report. */
export type WordReport = {
  id: string;
  wordId: string;
  /** The word as it was spelled when reported, kept in case the entry is later edited. */
  word: string;
  reasons: ReportReasonId[];
  stage: ReportStage | null;
  status: WordReportStatus;
  createdAt: string;
  resolvedAt: string | null;
};
