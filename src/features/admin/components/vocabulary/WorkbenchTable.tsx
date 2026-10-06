/**
 * The workbench table: sortable headers, page-wide selection, and server-side paging.
 *
 * Only the current page of rows ever reaches the browser, so the table renders the same
 * at twenty-five words and at ten thousand.
 *
 * Exports: WorkbenchTable
 * Depends on: React, lucide-react, WorkbenchRow, workbench-filter types
 */

import { ChevronDown, ChevronUp } from "lucide-react";
import type { WorkbenchStatus } from "@/features/vocabulary/lib/workbench";
import type { WorkbenchRow as Row, WorkbenchSort } from "../../lib/workbench-filter";
import { WorkbenchRow } from "./WorkbenchRow";

type Props = {
  rows: Row[];
  loading: boolean;
  selected: Set<string>;
  sort: WorkbenchSort;
  dir: "asc" | "desc";
  page: number;
  pageCount: number;
  total: number;
  readOnly: boolean;
  savingId: string | null;
  savedId: string | null;
  onSort: (sort: WorkbenchSort) => void;
  onSelect: (id: string, selected: boolean) => void;
  onSelectPage: (ids: string[], selected: boolean) => void;
  onPage: (page: number) => void;
  onSave: (id: string, field: string, value: string) => void;
  onStatus: (id: string, status: WorkbenchStatus) => void;
  onRegenerate: (
    id: string,
    field: "defVi" | "leadVi" | "anticipateVi",
    complaints: string[],
  ) => Promise<unknown>;
};

const COLUMNS: { key: WorkbenchSort | null; label: string; className?: string }[] = [
  { key: "word", label: "Word", className: "min-w-[11rem]" },
  { key: null, label: "Definition (Vi)", className: "min-w-[14rem]" },
  { key: null, label: "Lead (Vi)", className: "min-w-[12rem]" },
  { key: null, label: "Teaser (Vi)", className: "min-w-[10rem]" },
  { key: "level", label: "Level", className: "w-20" },
  { key: "status", label: "Stage", className: "w-32" },
  { key: "reports", label: "Reports", className: "w-24" },
];

/**
 * Paginated workbench table.
 * @returns table UI
 */
export function WorkbenchTable(props: Props): React.ReactElement {
  const { rows, loading, selected, sort, dir, page, pageCount, total } = props;
  const pageIds = rows.map((row) => row.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  return (
    <div className="min-w-0 flex-1 space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-2 py-2 w-8">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={(event) => props.onSelectPage(pageIds, event.target.checked)}
                  aria-label="Select every word on this page"
                />
              </th>
              {COLUMNS.map((column) => (
                <th
                  key={column.label}
                  className={`px-2 py-2 font-medium ${column.className ?? ""}`}
                >
                  {column.key ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-foreground"
                      onClick={() => props.onSort(column.key!)}
                    >
                      {column.label}
                      {sort === column.key &&
                        (dir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
              <th className="px-2 py-2 w-8" aria-label="Save state" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                  No word matches these filters.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <WorkbenchRow
                  key={row.id}
                  row={row}
                  selected={selected.has(row.id)}
                  saving={props.savingId === row.id}
                  saved={props.savedId === row.id}
                  readOnly={props.readOnly}
                  onSelect={props.onSelect}
                  onSave={props.onSave}
                  onStatus={props.onStatus}
                  onRegenerate={props.onRegenerate}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {total} word{total === 1 ? "" : "s"} · page {page + 1} of {pageCount}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border border-border px-2 py-1 disabled:opacity-40"
            disabled={page === 0}
            onClick={() => props.onPage(page - 1)}
          >
            Previous
          </button>
          <button
            type="button"
            className="rounded border border-border px-2 py-1 disabled:opacity-40"
            disabled={page >= pageCount - 1}
            onClick={() => props.onPage(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
