/**
 * Saved workbench queues, shown as the review surface's "folders".
 *
 * A queue stores filter parameters rather than a list of words, so "B2 reported twice
 * or more" keeps meaning that as the catalog grows and reports arrive — nothing has to
 * be refiled by hand.
 *
 * Exports: WorkbenchSavedViews
 * Depends on: React, TanStack Query, lucide-react, workbench view server functions
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FolderOpen, Plus, Trash2 } from "lucide-react";
import { adminKeys } from "../../api/keys";
import { adminWorkbenchViewsQueryOptions } from "../../api/queries";
import {
  deleteWorkbenchView,
  saveWorkbenchView,
  type WorkbenchView,
} from "../../api/workbench-views.functions";

type Props = {
  /** The filter params currently on the URL, which a new queue would store. */
  currentParams: Record<string, string>;
  activeViewId: string | null;
  readOnly: boolean;
  onOpen: (view: WorkbenchView) => void;
};

/**
 * Saved-queue strip with a save box for the current filters.
 * @returns saved queues UI
 */
export function WorkbenchSavedViews({
  currentParams,
  activeViewId,
  readOnly,
  onOpen,
}: Props): React.ReactElement {
  const queryClient = useQueryClient();
  const views = useQuery(adminWorkbenchViewsQueryOptions());
  const [name, setName] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: adminKeys.workbenchViews() });

  const save = useMutation({
    mutationFn: () => saveWorkbenchView({ data: { name: name.trim(), params: currentParams } }),
    onSuccess: () => {
      setName("");
      invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteWorkbenchView({ data: { id } }),
    onSuccess: invalidate,
  });

  const hasFilters = Object.keys(currentParams).length > 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <FolderOpen size={13} className="text-muted-foreground" />
        {(views.data ?? []).length === 0 ? (
          <span className="text-xs text-muted-foreground">
            No saved queues yet — filter, then save the view.
          </span>
        ) : (
          (views.data ?? []).map((view) => (
            <span
              key={view.id}
              className={`group inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${
                activeViewId === view.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border hover:bg-muted"
              }`}
            >
              <button type="button" onClick={() => onOpen(view)}>
                {view.name}
              </button>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => remove.mutate(view.id)}
                  aria-label={`Delete queue ${view.name}`}
                  className="opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100"
                >
                  <Trash2 size={10} />
                </button>
              )}
            </span>
          ))
        )}
      </div>

      {hasFilters && !readOnly && (
        <div className="flex items-center gap-1.5">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Save these filters as…"
            maxLength={60}
            className="w-56 rounded border border-border bg-background px-2 py-1 text-xs"
          />
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40"
            disabled={!name.trim() || save.isPending}
            onClick={() => save.mutate()}
          >
            <Plus size={11} /> Save queue
          </button>
          {save.isError && <span className="text-xs text-red-500">{save.error.message}</span>}
        </div>
      )}
    </div>
  );
}
