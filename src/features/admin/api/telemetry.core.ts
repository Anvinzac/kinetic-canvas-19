/**
 * Shared telemetry query/mutation core used by serverFns and HTTP contract routes.
 *
 * Exports: listEvents, listDailyRollups, listErrorReports, updateErrorStatus,
 *   logAdminAccess, ensureDemoSeeded, CursorPage
 * Depends on: demo-store, backfill seed, supabase, types
 */

import { seedDemoTelemetryFromMock } from "../lib/backfill";
import { readDemoTelemetry, writeDemoTelemetry } from "../lib/demo-store";
import { makeId } from "../lib/emit";
import {
  APP_ID,
  type AdminErrorReport,
  type DailyRollup,
  type ErrorReportStatus,
  type TelemetryEvent,
  type TelemetryEventType,
  type TelemetrySeverity,
} from "../types/telemetry";

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};

/**
 * Ensure demo store has seed data once.
 * @returns void
 */
export function ensureDemoSeeded(): void {
  const store = readDemoTelemetry();
  if (store.events.length === 0) {
    seedDemoTelemetryFromMock();
  }
}

/**
 * List telemetry events with cursor pagination (occurred_at|id).
 */
export async function listEvents(options: {
  mode: "demo" | "live";
  event_type?: TelemetryEventType;
  from?: string;
  to?: string;
  actor_user_id?: string;
  cursor?: string | null;
  limit?: number;
}): Promise<CursorPage<TelemetryEvent>> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);

  if (options.mode === "demo") {
    ensureDemoSeeded();
    let items = readDemoTelemetry().events;
    if (options.event_type) items = items.filter((e) => e.event_type === options.event_type);
    if (options.from) items = items.filter((e) => e.occurred_at >= options.from!);
    if (options.to) items = items.filter((e) => e.occurred_at <= options.to!);
    if (options.actor_user_id) {
      items = items.filter((e) => e.actor_user_id === options.actor_user_id);
    }
    items = items.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
    if (options.cursor) {
      const [ts, id] = options.cursor.split("|");
      items = items.filter(
        (e) => e.occurred_at < ts! || (e.occurred_at === ts && e.id < (id ?? "")),
      );
    }
    const page = items.slice(0, limit);
    const last = page[page.length - 1];
    return {
      items: page,
      nextCursor: page.length === limit && last ? `${last.occurred_at}|${last.id}` : null,
    };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let q = supabaseAdmin
    .from("telemetry_events")
    .select("*")
    .eq("app_id", APP_ID)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (options.event_type) q = q.eq("event_type", options.event_type);
  if (options.from) q = q.gte("occurred_at", options.from);
  if (options.to) q = q.lte("occurred_at", options.to);
  if (options.actor_user_id) q = q.eq("actor_user_id", options.actor_user_id);
  if (options.cursor) {
    const [ts, id] = options.cursor.split("|");
    q = q.or(`occurred_at.lt.${ts},and(occurred_at.eq.${ts},id.lt.${id})`);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const items = (data ?? []).map(mapEventRow);
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: items.length === limit && last ? `${last.occurred_at}|${last.id}` : null,
  };
}

function mapEventRow(row: {
  id: string;
  app_id: string;
  event_type: string;
  occurred_at: string;
  actor_user_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  metadata: unknown;
  severity: string | null;
}): TelemetryEvent {
  return {
    id: row.id,
    app_id: row.app_id,
    event_type: row.event_type as TelemetryEventType,
    occurred_at: row.occurred_at,
    actor_user_id: row.actor_user_id,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    metadata: (row.metadata ?? {}) as Record<string, string | number | boolean | null>,
    severity: row.severity as TelemetrySeverity | null,
  };
}

/**
 * List daily rollups in [from, to] inclusive (YYYY-MM-DD).
 */
export async function listDailyRollups(options: {
  mode: "demo" | "live";
  from: string;
  to: string;
}): Promise<DailyRollup[]> {
  if (options.mode === "demo") {
    ensureDemoSeeded();
    return readDemoTelemetry()
      .rollups.filter((r) => r.date >= options.from && r.date <= options.to)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("telemetry_daily_rollups")
    .select("*")
    .eq("app_id", APP_ID)
    .gte("date", options.from)
    .lte("date", options.to)
    .order("date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    app_id: r.app_id,
    date: r.date,
    new_users: r.new_users,
    active_users: r.active_users,
    content_created: r.content_created,
    content_updated: r.content_updated,
    links_created: r.links_created,
    link_interactions: r.link_interactions,
    errors_total: r.errors_total,
    errors_critical: r.errors_critical,
  }));
}

/**
 * List error reports with optional filters.
 */
export async function listErrorReports(options: {
  mode: "demo" | "live";
  status?: ErrorReportStatus;
  severity?: TelemetrySeverity;
  from?: string;
  to?: string;
  cursor?: string | null;
  limit?: number;
}): Promise<CursorPage<AdminErrorReport>> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);

  if (options.mode === "demo") {
    ensureDemoSeeded();
    let items = readDemoTelemetry().errors;
    if (options.status) items = items.filter((e) => e.status === options.status);
    if (options.severity) items = items.filter((e) => e.severity === options.severity);
    if (options.from) items = items.filter((e) => e.created_at >= options.from!);
    if (options.to) items = items.filter((e) => e.created_at <= options.to!);
    items = items.sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (options.cursor) {
      const [ts, id] = options.cursor.split("|");
      items = items.filter(
        (e) => e.created_at < ts! || (e.created_at === ts && e.id < (id ?? "")),
      );
    }
    const page = items.slice(0, limit);
    const last = page[page.length - 1];
    return {
      items: page,
      nextCursor: page.length === limit && last ? `${last.created_at}|${last.id}` : null,
    };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let q = supabaseAdmin
    .from("admin_error_reports")
    .select("*")
    .eq("app_id", APP_ID)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (options.status) q = q.eq("status", options.status);
  if (options.severity) q = q.eq("severity", options.severity);
  if (options.from) q = q.gte("created_at", options.from);
  if (options.to) q = q.lte("created_at", options.to);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const items = (data ?? []).map(
    (r): AdminErrorReport => ({
      id: r.id,
      event_id: r.event_id,
      app_id: r.app_id,
      status: r.status as ErrorReportStatus,
      message: r.message,
      severity: r.severity as TelemetrySeverity,
      actor_user_id: r.actor_user_id,
      metadata: (r.metadata ?? {}) as Record<string, string | number | boolean | null>,
      created_at: r.created_at,
      updated_at: r.updated_at,
      resolved_by: r.resolved_by,
      resolved_at: r.resolved_at,
    }),
  );
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: items.length === limit && last ? `${last.created_at}|${last.id}` : null,
  };
}

/**
 * Update error report status (acknowledge/resolve).
 */
export async function updateErrorStatus(options: {
  mode: "demo" | "live";
  id: string;
  status: ErrorReportStatus;
  actorUserId: string;
}): Promise<AdminErrorReport> {
  const now = new Date().toISOString();
  if (options.mode === "demo") {
    const store = readDemoTelemetry();
    const idx = store.errors.findIndex((e) => e.id === options.id);
    if (idx < 0) throw new Error("Error report not found");
    const prev = store.errors[idx]!;
    const next: AdminErrorReport = {
      ...prev,
      status: options.status,
      updated_at: now,
      resolved_by: options.status === "resolved" ? options.actorUserId : prev.resolved_by,
      resolved_at: options.status === "resolved" ? now : prev.resolved_at,
    };
    store.errors[idx] = next;
    writeDemoTelemetry(store);
    return next;
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const patch = {
    status: options.status,
    updated_at: now,
    ...(options.status === "resolved"
      ? { resolved_by: options.actorUserId, resolved_at: now }
      : {}),
  };
  const { data, error } = await supabaseAdmin
    .from("admin_error_reports")
    .update(patch)
    .eq("id", options.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return {
    id: data.id,
    event_id: data.event_id,
    app_id: data.app_id,
    status: data.status as ErrorReportStatus,
    message: data.message,
    severity: data.severity as TelemetrySeverity,
    actor_user_id: data.actor_user_id,
    metadata: (data.metadata ?? {}) as Record<string, string | number | boolean | null>,
    created_at: data.created_at,
    updated_at: data.updated_at,
    resolved_by: data.resolved_by,
    resolved_at: data.resolved_at,
  };
}

/**
 * Append admin access log entry.
 */
export async function logAdminAccess(options: {
  mode: "demo" | "live";
  actorUserId: string | null;
  path: string;
  method: string;
  metadata?: Record<string, string | number | boolean | null>;
}): Promise<void> {
  if (options.mode === "demo") {
    const store = readDemoTelemetry();
    store.accessLog = [
      {
        id: makeId(),
        actor_user_id: options.actorUserId,
        path: options.path,
        method: options.method,
        occurred_at: new Date().toISOString(),
      },
      ...store.accessLog,
    ].slice(0, 500);
    writeDemoTelemetry(store);
    return;
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("admin_access_log").insert({
    actor_user_id: options.actorUserId,
    path: options.path,
    method: options.method,
    metadata: (options.metadata ?? {}) as never,
  });
}
