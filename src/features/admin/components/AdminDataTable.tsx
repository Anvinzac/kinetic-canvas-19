/**
 * Shared TanStack Table shell for admin section lists (client page index).
 *
 * Exports: AdminDataTable
 * Depends on: @tanstack/react-table
 */

import { useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";

const DEFAULT_PAGE_SIZE = 50;

/**
 * Paginated admin data table with accessible empty state and prev/next controls.
 * @param props.data - row data
 * @param props.columns - column definitions
 * @param props.pageSize - rows per page (default 50, max 200)
 * @param props.emptyMessage - copy when there are no rows
 * @returns table UI
 */
export function AdminDataTable<T>({
  data,
  columns,
  pageSize = DEFAULT_PAGE_SIZE,
  emptyMessage = "No data in this range",
}: {
  data: T[];
  columns: ColumnDef<T>[];
  pageSize?: number;
  emptyMessage?: string;
}): React.ReactElement {
  const size = Math.min(Math.max(pageSize, 1), 200);
  const [pageIndex, setPageIndex] = useState(0);

  const table = useReactTable({
    data,
    columns,
    state: { pagination: { pageIndex, pageSize: size } },
    onPaginationChange: (updater) => {
      const next = typeof updater === "function" ? updater({ pageIndex, pageSize: size }) : updater;
      setPageIndex(next.pageIndex);
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: false,
  });

  const rows = table.getRowModel().rows;
  const pageCount = table.getPageCount();

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th key={header.id} className="px-3 py-2 font-medium">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-4 text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-border/60">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pageCount > 1 ? (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {pageIndex + 1} of {pageCount} · {data.length} rows
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded border border-border px-2 py-1 disabled:opacity-40"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              Previous
            </button>
            <button
              type="button"
              className="rounded border border-border px-2 py-1 disabled:opacity-40"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
