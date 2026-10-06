/**
 * Faceted filter rail for the vocabulary workbench.
 *
 * Every value carries the number of words it would match, counted with that axis's own
 * selection ignored — so narrowing to B2 still shows how many words the other levels
 * hold, and a reviewer can see where a thousand-word catalog actually sits.
 *
 * Exports: WorkbenchFilterRail
 * Depends on: React, lucide-react, vocabulary taxonomy + workbench statuses
 */

import { RotateCcw } from "lucide-react";
import { LEVELS } from "@/features/vocabulary/lib/schema";
import { EXAMS, TOPICS } from "@/features/vocabulary/lib/taxonomy";
import { WORKBENCH_STATUSES } from "@/features/vocabulary/lib/workbench";
import type { WorkbenchFacets } from "../../lib/workbench-filter";

type Axis = "levels" | "topics" | "exams" | "statuses";

type Props = {
  facets: WorkbenchFacets;
  /** Current selection per axis, already split out of the URL. */
  selected: Record<Axis, string[]>;
  minOpenReports: number;
  drift: "yes" | "no" | undefined;
  openReportTotal: number;
  driftedTotal: number;
  activeCount: number;
  onToggle: (axis: Axis, value: string) => void;
  onReports: (value: number) => void;
  onDrift: (value: "yes" | "no" | undefined) => void;
  onClear: () => void;
};

/**
 * The workbench's left rail: one group per grouping axis plus the derived signals.
 * @returns filter rail UI
 */
export function WorkbenchFilterRail({
  facets,
  selected,
  minOpenReports,
  drift,
  openReportTotal,
  driftedTotal,
  activeCount,
  onToggle,
  onReports,
  onDrift,
  onClear,
}: Props): React.ReactElement {
  return (
    <aside className="w-full shrink-0 space-y-5 sm:w-56">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Filters
        </h3>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw size={11} /> Clear {activeCount}
          </button>
        )}
      </div>

      <Group
        title="Stage"
        options={WORKBENCH_STATUSES.map((status) => ({
          value: status.id,
          label: status.en,
          title: status.hint,
        }))}
        counts={facets.statuses}
        selected={selected.statuses}
        onToggle={(value) => onToggle("statuses", value)}
      />

      <Group
        title="Level"
        options={LEVELS.map((level) => ({ value: level, label: level }))}
        counts={facets.levels}
        selected={selected.levels}
        onToggle={(value) => onToggle("levels", value)}
      />

      <Group
        title="Exam"
        options={EXAMS.map((exam) => ({ value: exam.id, label: exam.en }))}
        counts={facets.exams}
        selected={selected.exams}
        onToggle={(value) => onToggle("exams", value)}
      />

      <Group
        title="Usage"
        options={TOPICS.map((topic) => ({ value: topic.id, label: topic.en }))}
        counts={facets.topics}
        selected={selected.topics}
        onToggle={(value) => onToggle("topics", value)}
      />

      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Attention
        </h4>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={minOpenReports > 0}
            onChange={(event) => onReports(event.target.checked ? 1 : 0)}
          />
          <span className="flex-1">Reported by readers</span>
          <span className="tabular-nums text-muted-foreground">{openReportTotal}</span>
        </label>
        {minOpenReports > 0 && (
          <label className="flex items-center gap-2 pl-6 text-xs text-muted-foreground">
            at least
            <input
              type="number"
              min={1}
              max={99}
              value={minOpenReports}
              onChange={(event) => onReports(Math.max(1, Number(event.target.value) || 1))}
              className="w-14 rounded border border-border bg-background px-1.5 py-0.5 tabular-nums"
            />
            reports
          </label>
        )}
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={drift === "yes"}
            onChange={(event) => onDrift(event.target.checked ? "yes" : undefined)}
          />
          <span className="flex-1">Edited since publish</span>
          <span className="tabular-nums text-muted-foreground">{driftedTotal}</span>
        </label>
      </div>
    </aside>
  );
}

type Option = { value: string; label: string; title?: string };

function Group({
  title,
  options,
  counts,
  selected,
  onToggle,
}: {
  title: string;
  options: Option[];
  counts: Record<string, number>;
  selected: string[];
  onToggle: (value: string) => void;
}): React.ReactElement {
  // A value nobody has used yet is hidden unless it is selected, so the rail reflects
  // the catalog that exists rather than the whole vocabulary of possible tags.
  const used = options.filter((option) => counts[option.value] || selected.includes(option.value));

  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      {used.length === 0 ? (
        <p className="text-xs text-muted-foreground/70">None yet</p>
      ) : (
        used.map((option) => (
          <label
            key={option.value}
            title={option.title}
            className="flex cursor-pointer items-center gap-2 text-xs"
          >
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={() => onToggle(option.value)}
            />
            <span className="flex-1 truncate">{option.label}</span>
            <span className="tabular-nums text-muted-foreground">{counts[option.value] ?? 0}</span>
          </label>
        ))
      )}
    </div>
  );
}
