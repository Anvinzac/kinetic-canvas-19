/**
 * Telemetry write helpers (error status updates, admin access log).
 *
 * Exports: updateErrorStatus, logAdminAccess
 * Depends on: demo-store, emit makeId, supabase, types
 */

import { readDemoTelemetry, writeDemoTelemetry } from "../lib/demo-store";
import { makeId } from "../lib/emit";
import type { AdminErrorReport, ErrorReportStatus, TelemetrySeverity } from "../types/telemetry";

/**
 * Update error report status (acknowledge/resolve).
 * @param options - mode, report id, new status, acting admin user id
 * @returns updated error report
 * @throws when report is missing
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
 * @param options - mode, actor, path, method, optional metadata
 * @returns void
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
