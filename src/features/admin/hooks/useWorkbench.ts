/**
 * All state and server talk behind the vocabulary workbench page.
 *
 * The query lives in the URL rather than in component state, so every navigation helper
 * here rewrites search params and the page re-reads them. That is what makes a filtered
 * queue a link and lets a saved queue be nothing but stored parameters.
 *
 * Exports: useWorkbench, UseWorkbench
 * Depends on: TanStack Query/Router, workbench server functions, workbench-params
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { WorkbenchStatus } from "@/features/vocabulary/lib/workbench";
import { adminKeys } from "../api/keys";
import { adminWorkbenchQueryOptions } from "../api/queries";
import {
  bulkUpdateWorkbench,
  migrateWorkbench,
  regenerateWorkbenchField,
  updateWorkbenchWord,
} from "../api/workbench-write.functions";
import type { WorkbenchView } from "../api/workbench-views.functions";
import type { BulkSet } from "../components/vocabulary/WorkbenchBulkBar";
import type { AdminSearch } from "../lib/search-schema";
import type { WorkbenchSort } from "../lib/workbench-filter";
import { toWorkbenchQuery, toggleAxis } from "../lib/workbench-params";

const WORKBENCH_KEY = [...adminKeys.all, "workbench"];
type RegenField = "defVi" | "leadVi" | "anticipateVi";

/** The two params every admin route needs present, restated so a patch stays valid. */
function withChrome(
  search: AdminSearch,
): AdminSearch & { range: AdminSearch["range"]; app: string } {
  return { ...search, range: search.range ?? "30d", app: search.app ?? "kinetic-canvas" };
}

/**
 * Wire the workbench page to its query, its mutations and its selection.
 * @returns Everything the page and its panels need
 */
export function useWorkbench() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const search = useRouterState({ select: (state) => state.location.search as AdminSearch });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [wholeQuery, setWholeQuery] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<string | null>(null);

  const query = useMemo(() => toWorkbenchQuery(search), [search]);
  const list = useQuery(adminWorkbenchQueryOptions(query));
  const rows = list.data?.rows ?? [];
  const readOnly = list.data ? !list.data.writable : false;

  const go = (next: (current: AdminSearch) => Partial<AdminSearch>, keepView = false) => {
    if (!keepView) setActiveView(null);
    navigate({
      to: "/admin/vocabulary",
      search: (previous) =>
        withChrome({ ...(previous as AdminSearch), ...next(previous as AdminSearch) }),
    });
  };

  const refresh = () => queryClient.invalidateQueries({ queryKey: WORKBENCH_KEY });
  const flash = (id: string) => {
    setSaving(null);
    setSaved(id);
    setTimeout(() => setSaved((current) => (current === id ? null : current)), 1500);
  };

  const update = useMutation({
    mutationFn: (input: {
      id: string;
      fields: Record<string, unknown>;
      expectedUpdatedAt: string;
    }) => updateWorkbenchWord({ data: input }),
    onMutate: (input) => setSaving(input.id),
    onSuccess: (_result, input) => {
      flash(input.id);
      refresh();
    },
    onError: () => setSaving(null),
  });

  const bulk = useMutation({
    mutationFn: (set: BulkSet) =>
      bulkUpdateWorkbench({ data: wholeQuery ? { query, set } : { ids: [...selected], set } }),
    onSuccess: () => {
      setSelected(new Set());
      setWholeQuery(false);
      refresh();
    },
  });

  const regenerate = useMutation({
    mutationFn: (input: { id: string; field: RegenField; complaints: string[] }) =>
      regenerateWorkbenchField({ data: input }),
    onSuccess: (_result, input) => {
      flash(input.id);
      refresh();
    },
  });

  const migrate = useMutation({
    mutationFn: () => migrateWorkbench({ data: { force: false } }),
    onSuccess: refresh,
  });

  /** Edits go out with the timestamp they were based on, so a stale save is refused. */
  const editWord = (id: string, fields: Record<string, unknown>) => {
    const row = rows.find((entry) => entry.id === id);
    if (row) update.mutate({ id, fields, expectedUpdatedAt: row.updatedAt });
  };

  return {
    search,
    list,
    rows,
    readOnly,
    selected,
    wholeQuery,
    saving,
    saved,
    activeView,
    pending: { bulk: bulk.isPending, migrate: migrate.isPending },
    error: (update.error ?? bulk.error ?? regenerate.error)?.message ?? null,
    migrateError: migrate.error?.message ?? null,

    setFilter: (next: Partial<AdminSearch>) => go(() => ({ ...next, page: 0 })),
    toggleFilter: (axis: "levels" | "topics" | "exams" | "statuses", value: string) =>
      go((current) => ({ [axis]: toggleAxis(current[axis], value), page: 0 })),
    clearFilters: () =>
      go(() => ({
        q: undefined,
        levels: undefined,
        topics: undefined,
        exams: undefined,
        statuses: undefined,
        reports: undefined,
        drift: undefined,
        page: 0,
      })),
    goPage: (page: number) => go(() => ({ page }), true),
    setSort: (sort: WorkbenchSort) =>
      go((current) => ({
        sort,
        dir: current.sort === sort && current.dir === "asc" ? "desc" : "asc",
        page: 0,
      })),
    openView: (view: WorkbenchView) => {
      go(
        () => ({
          q: undefined,
          levels: undefined,
          topics: undefined,
          exams: undefined,
          statuses: undefined,
          reports: undefined,
          drift: undefined,
          ...(view.params as Partial<AdminSearch>),
          page: 0,
        }),
        true,
      );
      setActiveView(view.id);
    },

    toggleSelect: (id: string, on: boolean) => {
      setWholeQuery(false);
      setSelected((previous) => {
        const next = new Set(previous);
        if (on) next.add(id);
        else next.delete(id);
        return next;
      });
    },
    selectPage: (ids: string[], on: boolean) =>
      setSelected((previous) => {
        const next = new Set(previous);
        for (const id of ids) {
          if (on) next.add(id);
          else next.delete(id);
        }
        return next;
      }),
    selectAllMatching: () => setWholeQuery(true),
    clearSelection: () => {
      setSelected(new Set());
      setWholeQuery(false);
    },

    saveField: (id: string, field: string, value: string) =>
      editWord(id, field === "level" ? { level: value || null } : { [field]: value }),
    setStatus: (id: string, status: WorkbenchStatus) => editWord(id, { status }),
    regenerateField: (id: string, field: RegenField, complaints: string[]) =>
      regenerate.mutateAsync({ id, field, complaints }),
    applyBulk: (set: BulkSet) => bulk.mutate(set),
    runMigrate: () => migrate.mutate(),
    refresh,
  };
}

export type UseWorkbench = ReturnType<typeof useWorkbench>;
