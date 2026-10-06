/**
 * One word in the workbench table: editable Vietnamese fields, its stage, its tags,
 * and what readers have complained about.
 *
 * The report badge names the top reason inline, so judging a complaint does not mean
 * leaving the page for the reports list and losing the filter you were working in.
 *
 * Exports: WorkbenchRow
 * Depends on: React, lucide-react, EditableCell, FlagRegenerateMenu, report reasons
 */

import { Check, Loader2, PenLine } from "lucide-react";
import { LEVELS } from "@/features/vocabulary/lib/schema";
import { getExam, getTopic } from "@/features/vocabulary/lib/taxonomy";
import { WORKBENCH_STATUSES, type WorkbenchStatus } from "@/features/vocabulary/lib/workbench";
import type { WorkbenchRow as Row } from "../../lib/workbench-filter";
import { EditableCell } from "./EditableCell";
import { WorkbenchReportCell } from "./WorkbenchReportCell";
import { WorkbenchTextCell } from "./WorkbenchTextCell";

type RegenField = "defVi" | "leadVi" | "anticipateVi";

const TEXT_FIELDS: { field: RegenField; label: string; multiline?: boolean }[] = [
  { field: "defVi", label: "definition", multiline: true },
  { field: "leadVi", label: "lead" },
  { field: "anticipateVi", label: "teaser" },
];

type Props = {
  row: Row;
  selected: boolean;
  saving: boolean;
  saved: boolean;
  readOnly: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onSave: (id: string, field: string, value: string) => void;
  onStatus: (id: string, status: WorkbenchStatus) => void;
  onRegenerate: (id: string, field: RegenField, complaints: string[]) => Promise<unknown>;
};

const STATUS_STYLES: Record<WorkbenchStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  "needs-review": "bg-amber-500/15 text-amber-600",
  approved: "bg-green-500/15 text-green-600",
  rejected: "bg-red-500/10 text-red-500",
};

/**
 * A workbench table row.
 * @returns row UI
 */
export function WorkbenchRow({
  row,
  selected,
  saving,
  saved,
  readOnly,
  onSelect,
  onSave,
  onStatus,
  onRegenerate,
}: Props): React.ReactElement {
  const tint = saved
    ? "bg-green-500/5"
    : saving
      ? "bg-yellow-500/5"
      : selected
        ? "bg-muted/40"
        : "";

  return (
    <tr className={`border-b border-border/60 align-top ${tint}`}>
      <td className="px-2 py-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => onSelect(row.id, event.target.checked)}
          aria-label={`Select ${row.word}`}
        />
      </td>

      <td className="px-2 py-2">
        <div className="font-medium">
          <EditableCell
            value={row.word}
            onSave={(value) => onSave(row.id, "word", value)}
            placeholder="word"
          />
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {[row.ipa, row.pos].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {row.exams.map((exam) => (
            <span
              key={exam}
              className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-500"
            >
              {getExam(exam)?.en ?? exam}
            </span>
          ))}
          {row.topics.map((topic) => (
            <span key={topic} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
              {getTopic(topic)?.en ?? topic}
            </span>
          ))}
        </div>
      </td>

      {TEXT_FIELDS.map(({ field, label, multiline }) => (
        <WorkbenchTextCell
          key={field}
          value={row[field]}
          word={row.word}
          label={label}
          multiline={multiline}
          onSave={(value) => onSave(row.id, field, value)}
          onRegenerate={(complaints) => onRegenerate(row.id, field, complaints)}
        />
      ))}

      <td className="px-2 py-2">
        <select
          className="rounded border-none bg-transparent py-1 text-sm hover:bg-muted/60"
          value={row.level ?? ""}
          onChange={(event) => onSave(row.id, "level", event.target.value)}
          aria-label={`Level of ${row.word}`}
        >
          <option value="">—</option>
          {LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </td>

      <td className="px-2 py-2">
        <select
          className={`rounded px-1.5 py-1 text-[11px] font-medium ${STATUS_STYLES[row.status]}`}
          value={row.status}
          disabled={readOnly}
          onChange={(event) => onStatus(row.id, event.target.value as WorkbenchStatus)}
          aria-label={`Stage of ${row.word}`}
        >
          {WORKBENCH_STATUSES.map((status) => (
            <option key={status.id} value={status.id}>
              {status.en}
            </option>
          ))}
        </select>
        {row.drifted && (
          <p
            className="mt-1 flex items-center gap-1 text-[10px] text-amber-600"
            title="This word has been edited since it was last published"
          >
            <PenLine size={10} /> unpublished
          </p>
        )}
        {!row.published && row.status === "approved" && (
          <p className="mt-1 text-[10px] text-muted-foreground">not yet published</p>
        )}
      </td>

      <WorkbenchReportCell openReports={row.openReports} topReasons={row.topReasons} />

      <td className="px-2 py-2 text-center">
        {saving ? (
          <Loader2 size={13} className="animate-spin text-muted-foreground" />
        ) : saved ? (
          <Check size={13} className="text-green-600" />
        ) : null}
      </td>
    </tr>
  );
}
