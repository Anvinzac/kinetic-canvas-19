/**
 * Admin TanStack Query options (demo vs live).
 *
 * Exports: adminRollupsQueryOptions, adminEventsQueryOptions, adminHealthQueryOptions,
 *   adminHealthHistoryQueryOptions, adminErrorsQueryOptions
 * Depends on: keys, telemetry.functions, shared runDataMode pattern via mode param
 */

import { queryOptions } from "@tanstack/react-query";
import { adminKeys } from "./keys";
import {
  getAdminErrors,
  getAdminEvents,
  getAdminHealth,
  getAdminHealthHistory,
  getAdminRollups,
} from "./telemetry.functions";
import { listWordReportGroups } from "./word-report.functions";
import { listWorkbenchWords, type WorkbenchListResult } from "./workbench.functions";
import { listWorkbenchViews, type WorkbenchView } from "./workbench-views.functions";
import { listTemplates, type TemplateData } from "./template.functions";
import { listPalettes } from "./palette.functions";
import type { Palette } from "@/features/canvas/palettes";
import { ensureDemoSeeded, listDailyRollups, listErrorReports, listEvents } from "./telemetry.core";
import { buildHealthSnapshot } from "../lib/health";
import { readDemoTelemetry } from "../lib/demo-store";

export type AdminMode = "demo" | "live";

/**
 * Daily rollups query.
 * @param from - YYYY-MM-DD
 * @param to - YYYY-MM-DD
 * @param mode - demo|live
 * @returns query options
 */
export function adminRollupsQueryOptions(from: string, to: string, mode: AdminMode) {
  return queryOptions({
    queryKey: adminKeys.rollups(from, to, mode),
    staleTime: 60_000,
    queryFn: async () => {
      if (mode === "demo") {
        ensureDemoSeeded();
        return listDailyRollups({ mode, from, to });
      }
      return getAdminRollups({ data: { from, to, mode } });
    },
  });
}

/**
 * Recent events query.
 */
export function adminEventsQueryOptions(from: string, to: string, mode: AdminMode) {
  return queryOptions({
    queryKey: adminKeys.events(from, to, mode),
    staleTime: 0,
    refetchInterval: 15_000,
    queryFn: async () => {
      if (mode === "demo") {
        ensureDemoSeeded();
        return listEvents({
          mode,
          from: `${from}T00:00:00.000Z`,
          to: `${to}T23:59:59.999Z`,
          limit: 200,
        });
      }
      return getAdminEvents({
        data: {
          mode,
          from: `${from}T00:00:00.000Z`,
          to: `${to}T23:59:59.999Z`,
          limit: 200,
        },
      });
    },
  });
}

/**
 * Live health snapshot (poll aggressively).
 */
export function adminHealthQueryOptions(mode: AdminMode) {
  return queryOptions({
    queryKey: adminKeys.health(mode),
    staleTime: 0,
    refetchInterval: 15_000,
    queryFn: async () => {
      if (mode === "demo") return buildHealthSnapshot("demo");
      return getAdminHealth({ data: { mode } });
    },
  });
}

/**
 * Health history for charts.
 */
export function adminHealthHistoryQueryOptions(mode: AdminMode) {
  return queryOptions({
    queryKey: adminKeys.healthHistory(mode),
    staleTime: 60_000,
    refetchInterval: 30_000,
    queryFn: async () => {
      if (mode === "demo") {
        ensureDemoSeeded();
        return readDemoTelemetry().healthHistory;
      }
      return getAdminHealthHistory({ data: { mode } });
    },
  });
}

/**
 * One page of the vocabulary review workbench.
 *
 * The query object is the cache key, so changing a filter fetches that page rather
 * than re-filtering a copy of the whole catalog in the browser.
 * @param query - filter/sort/page parameters as the page keeps them in its URL
 * @returns Query options for the workbench page
 */
export function adminWorkbenchQueryOptions(query: Record<string, string | number>) {
  return queryOptions({
    queryKey: adminKeys.workbench(JSON.stringify(query)),
    staleTime: 10_000,
    queryFn: () => listWorkbenchWords({ data: query }) as Promise<WorkbenchListResult>,
  });
}

/**
 * Saved workbench queues.
 * @returns Query options for the saved-queue list
 */
export function adminWorkbenchViewsQueryOptions() {
  return queryOptions({
    queryKey: adminKeys.workbenchViews(),
    staleTime: 60_000,
    queryFn: () => listWorkbenchViews() as Promise<WorkbenchView[]>,
  });
}

/**
 * Anonymous word reports from the feed, grouped by word.
 */
export function adminWordReportsQueryOptions() {
  return queryOptions({
    queryKey: adminKeys.wordReports(),
    staleTime: 15_000,
    refetchInterval: 60_000,
    queryFn: () => listWordReportGroups(),
  });
}

/**
 * Template data (gradients, patterns, scenes, etc.).
 */
export function adminTemplatesQueryOptions() {
  return queryOptions({
    queryKey: adminKeys.templates(),
    staleTime: 30_000,
    queryFn: () => listTemplates() as Promise<TemplateData>,
  });
}

/**
 * Palette collection. File-backed like templates, so it does not branch on mode.
 */
export function adminPalettesQueryOptions() {
  return queryOptions({
    queryKey: adminKeys.palettes(),
    staleTime: 30_000,
    queryFn: () => listPalettes() as Promise<Palette[]>,
  });
}

/**
 * Error reports list.
 */
export function adminErrorsQueryOptions(
  from: string,
  to: string,
  mode: AdminMode,
  status?: "new" | "acknowledged" | "resolved",
) {
  return queryOptions({
    queryKey: adminKeys.errors(from, to, mode, status),
    staleTime: 0,
    refetchInterval: 15_000,
    queryFn: async () => {
      if (mode === "demo") {
        ensureDemoSeeded();
        return listErrorReports({
          mode,
          status,
          from: `${from}T00:00:00.000Z`,
          to: `${to}T23:59:59.999Z`,
          limit: 100,
        });
      }
      return getAdminErrors({
        data: {
          mode,
          status,
          from: `${from}T00:00:00.000Z`,
          to: `${to}T23:59:59.999Z`,
          limit: 100,
        },
      });
    },
  });
}

/**
 * Session health metrics: aggregate page.loaded/page.failed events by session.
 */
export type SessionHealthSummary = {
  totalSessions: number;
  sessionsWithErrors: number;
  totalLoads: number;
  totalFailures: number;
  failureRate: number;
  topErrors: Array<{ message: string; count: number }>;
};

export function adminSessionHealthQueryOptions(
  from: string,
  to: string,
  mode: AdminMode,
) {
  return queryOptions({
    queryKey: adminKeys.sessionHealth(from, to, mode),
    staleTime: 30_000,
    refetchInterval: 30_000,
    queryFn: async (): Promise<SessionHealthSummary> => {
      if (mode === "demo") {
        ensureDemoSeeded();
        const page = await listEvents({
          mode,
          from: `${from}T00:00:00.000Z`,
          to: `${to}T23:59:59.999Z`,
          limit: 200,
        });
        return computeSessionHealth(page.items);
      }
      const page = await getAdminEvents({
        data: {
          mode,
          from: `${from}T00:00:00.000Z`,
          to: `${to}T23:59:59.999Z`,
          limit: 200,
        },
      });
      return computeSessionHealth(page.items);
    },
  });
}

function computeSessionHealth(
  events: Array<{ event_type: string; entity_id?: string | null; metadata?: Record<string, unknown> }>,
): SessionHealthSummary {
  const loads = events.filter((e) => e.event_type === "page.loaded");
  const failures = events.filter((e) => e.event_type === "page.failed");
  const sessionIds = new Set<string>();
  const errorSessions = new Set<string>();
  const errorCounts = new Map<string, number>();

  for (const e of loads) {
    if (e.entity_id) sessionIds.add(e.entity_id);
  }
  for (const e of failures) {
    if (e.entity_id) {
      sessionIds.add(e.entity_id);
      errorSessions.add(e.entity_id);
    }
    const msg = String(e.metadata?.message ?? "unknown");
    errorCounts.set(msg, (errorCounts.get(msg) ?? 0) + 1);
  }

  const topErrors = Array.from(errorCounts.entries())
    .map(([message, count]) => ({ message, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const totalSessions = sessionIds.size;
  const sessionsWithErrors = errorSessions.size;
  const totalLoads = loads.length;
  const totalFailures = failures.length;
  const failureRate = totalLoads + totalFailures > 0 ? totalFailures / (totalLoads + totalFailures) : 0;

  return { totalSessions, sessionsWithErrors, totalLoads, totalFailures, failureRate, topErrors };
}