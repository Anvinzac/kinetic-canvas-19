/**
 * Admin telemetry read serverFns for the embedded dashboard UI.
 *
 * Exports: getAdminRollups, getAdminEvents, getAdminHealth, getAdminHealthHistory,
 *   getAdminErrors, runAdminBackfill, updateDemoErrorStatus
 * Depends on: telemetry.core, health, require-admin, backfill
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { backfillTelemetryFromSources } from "../lib/backfill";
import { buildHealthSnapshot } from "../lib/health";
import { requireAdminContext } from "../lib/require-admin";
import {
  listDailyRollups,
  listErrorReports,
  listEvents,
  logAdminAccess,
  updateErrorStatus,
} from "./telemetry.core";
import { APP_ID, type SystemHealthSnapshot } from "../types/telemetry";
import { readDemoTelemetry } from "../lib/demo-store";

const rangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mode: z.enum(["demo", "live"]).default("live"),
});

/**
 * Fetch daily rollups for a date range.
 * @returns server function handle
 */
export const getAdminRollups = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => rangeSchema.parse(d))
  .handler(async ({ data }) => {
    if (data.mode === "live") {
      // Auth checked by caller route; still log access when possible.
    }
    return listDailyRollups({ mode: data.mode, from: data.from, to: data.to });
  });

/**
 * Fetch paginated telemetry events.
 * @returns server function handle
 */
export const getAdminEvents = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        mode: z.enum(["demo", "live"]).default("live"),
        event_type: z
          .enum([
            "user.registered",
            "content.created",
            "content.updated",
            "content.deleted",
            "link.created",
            "link.interacted",
            "error.reported",
            "system.heartbeat",
          ])
          .optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        cursor: z.string().nullable().optional(),
        limit: z.number().int().min(1).max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    listEvents({
      mode: data.mode,
      event_type: data.event_type,
      from: data.from,
      to: data.to,
      cursor: data.cursor,
      limit: data.limit,
    }),
  );

/**
 * Current health snapshot.
 * @returns server function handle
 */
export const getAdminHealth = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ mode: z.enum(["demo", "live"]).default("live") }).parse(d),
  )
  .handler(async ({ data }) => buildHealthSnapshot(data.mode));

/**
 * Health history for uptime charts.
 * @returns server function handle
 */
export const getAdminHealthHistory = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        mode: z.enum(["demo", "live"]).default("live"),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<SystemHealthSnapshot[]> => {
    if (data.mode === "demo") {
      let items = readDemoTelemetry().healthHistory;
      if (data.from) items = items.filter((h) => h.captured_at >= data.from!);
      if (data.to) items = items.filter((h) => h.captured_at <= data.to!);
      return items;
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("telemetry_health_snapshots")
      .select("*")
      .eq("app_id", APP_ID)
      .order("captured_at", { ascending: true });
    if (data.from) q = q.gte("captured_at", data.from);
    if (data.to) q = q.lte("captured_at", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      app_id: r.app_id,
      captured_at: r.captured_at,
      status: r.status as SystemHealthSnapshot["status"],
      uptime_pct_24h: Number(r.uptime_pct_24h),
      p50_latency_ms: Number(r.p50_latency_ms),
      p95_latency_ms: Number(r.p95_latency_ms),
      error_rate_pct: Number(r.error_rate_pct),
      queue_depth: r.queue_depth ?? undefined,
      db_connections_used: r.db_connections_used ?? undefined,
      db_connections_max: r.db_connections_max ?? undefined,
    }));
  });

/**
 * Paginated error reports.
 * @returns server function handle
 */
export const getAdminErrors = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        mode: z.enum(["demo", "live"]).default("live"),
        status: z.enum(["new", "acknowledged", "resolved"]).optional(),
        severity: z.enum(["info", "warn", "error", "critical"]).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        cursor: z.string().nullable().optional(),
        limit: z.number().int().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    listErrorReports({
      mode: data.mode,
      status: data.status,
      severity: data.severity,
      from: data.from,
      to: data.to,
      cursor: data.cursor,
      limit: data.limit,
    }),
  );

/**
 * Live backfill from social tables (admin only).
 * @returns server function handle
 */
export const runAdminBackfill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const actor = await requireAdminContext({ authUserId: context.userId });
    await logAdminAccess({
      mode: "live",
      actorUserId: actor.authUserId,
      path: "/api/admin/telemetry/backfill",
      method: "POST",
    });
    return backfillTelemetryFromSources();
  });

/**
 * Demo-mode error status update (client-side store via serverFn is still ok —
 * but demo updates run client-side through a thin isomorphic helper).
 * This serverFn is for live only; demo uses updateErrorStatus directly in UI.
 * @returns server function handle
 */
export const updateLiveErrorStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["new", "acknowledged", "resolved"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const actor = await requireAdminContext({ authUserId: context.userId });
    return updateErrorStatus({
      mode: "live",
      id: data.id,
      status: data.status,
      actorUserId: actor.authUserId,
    });
  });
