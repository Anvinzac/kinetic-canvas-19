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
