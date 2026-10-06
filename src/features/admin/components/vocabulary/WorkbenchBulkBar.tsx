/**
 * Action bar for a selection of workbench words.
 *
 * At a thousand words the unit of work is a group, not a row, so this applies one
 * change to everything selected in a single request. "Select all matching" hands the
 * server the active query instead of thousands of ids.
 *
 * Exports: WorkbenchBulkBar, BulkSet
 * Depends on: React, lucide-react, vocabulary taxonomy + workbench statuses
 */

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { EXAMS, TOPICS } from "@/features/vocabulary/lib/taxonomy";
import { WORKBENCH_STATUSES, type WorkbenchStatus } from "@/features/vocabulary/lib/workbench";

export type BulkSet = {
  status?: WorkbenchStatus;
  addTopics?: string[];
  removeTopics?: string[];
  addExams?: string[];
  removeExams?: string[];
};

type Props = {
  selectedCount: number;
  matchingTotal: number;
  /** True once the selection covers every word the filters match, not just this page. */
  wholeQuerySelected: boolean;
  pending: boolean;
  onSelectAllMatching: () => void;
  onClear: () => void;
  onApply: (set: BulkSet) => void;
};

/**
 * Selection action bar, shown only while something is selected.
 * @returns bulk action UI
 */
export function WorkbenchBulkBar({
  selectedCount,
  matchingTotal,
  wholeQuerySelected,
  pending,
  onSelectAllMatching,
  onClear,
  onApply,
}: Props): React.ReactElement | null {
  const [tag, setTag] = useState("");

  if (selectedCount === 0) return null;

  const applyTag = (mode: "add" | "remove") => {
    if (!tag) return;
    const [kind, value] = tag.split(":");
    if (kind === "topic") {
      onApply(mode === "add" ? { addTopics: [value!] } : { removeTopics: [value!] });
    } else {
      onApply(mode === "add" ? { addExams: [value!] } : { removeExams: [value!] });
    }
  };

  return (
    <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background/95 px-3 py-2.5 shadow-lg backdrop-blur">
      <span className="text-sm font-medium">
        {wholeQuerySelected ? `All ${matchingTotal}` : selectedCount} selected
      </span>

      {!wholeQuerySelected && matchingTotal > selectedCount && (
        <button
          type="button"
          onClick={onSelectAllMatching}
          className="text-xs text-primary underline-offset-2 hover:underline"
        >
          Select all {matchingTotal} matching
        </button>
      )}

      <div className="flex items-center gap-1.5">
        <label className="text-xs text-muted-foreground" htmlFor="bulk-stage">
          Stage
        </label>
        <select
          id="bulk-stage"
          className="rounded border border-border bg-background px-2 py-1 text-xs"
          value=""
          disabled={pending}
          onChange={(event) => {
            if (event.target.value) onApply({ status: event.target.value as WorkbenchStatus });
          }}
        >
          <option value="">Set to…</option>
          {WORKBENCH_STATUSES.map((status) => (
            <option key={status.id} value={status.id}>
              {status.en}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1.5">
        <select
          className="rounded border border-border bg-background px-2 py-1 text-xs"
          value={tag}
          onChange={(event) => setTag(event.target.value)}
          aria-label="Tag to add or remove"
        >
          <option value="">Tag…</option>
          <optgroup label="Exam">
            {EXAMS.map((exam) => (
              <option key={exam.id} value={`exam:${exam.id}`}>
                {exam.en}
              </option>
            ))}
          </optgroup>
          <optgroup label="Usage">
            {TOPICS.map((topic) => (
              <option key={topic.id} value={`topic:${topic.id}`}>
                {topic.en}
              </option>
            ))}
          </optgroup>
        </select>
        <button
          type="button"
          className="rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40"
          disabled={!tag || pending}
          onClick={() => applyTag("add")}
        >
          Add
        </button>
        <button
          type="button"
          className="rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40"
          disabled={!tag || pending}
          onClick={() => applyTag("remove")}
        >
          Remove
        </button>
      </div>

      {pending && <Loader2 size={14} className="animate-spin text-muted-foreground" />}

      <button
        type="button"
        onClick={onClear}
        className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <X size={12} /> Clear
      </button>
    </div>
  );
}
