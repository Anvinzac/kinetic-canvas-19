/**
 * Emit telemetry events and bump daily rollups (live via supabaseAdmin, demo via store).
 *
 * Exports: emitTelemetryEvent, EmitTelemetryInput, makeId
 * Depends on: demo-store, telemetry types, supabase admin
 */

import type { Json } from "@/integrations/supabase/types";
import {
  ensureRollup,
  readDemoTelemetry,
  utcDateKey,
  writeDemoTelemetry,
  type DemoTelemetryStore,
} from "./demo-store";
import {
  APP_ID,
  type AdminErrorReport,
  type TelemetryEvent,
  type TelemetryEventType,
  type TelemetrySeverity,
} from "../types/telemetry";

export type EmitTelemetryInput = {
  event_type: TelemetryEventType;
  occurred_at?: string;
  actor_user_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
  severity?: TelemetrySeverity | null;
  /** When true, also insert admin_error_reports */
  asErrorReport?: boolean;
  errorMessage?: string;
  mode?: "live" | "demo";
};

/**
 * Generate a random UUID (crypto when available).
 * @returns uuid string
 */
export function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `00000000-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, "0")}`;
}

function rollupDeltas(eventType: TelemetryEventType, severity?: TelemetrySeverity | null) {
  return {
    new_users: eventType === "user.registered" ? 1 : 0,
    content_created: eventType === "content.created" ? 1 : 0,
    content_updated: eventType === "content.updated" ? 1 : 0,
    links_created: eventType === "link.created" ? 1 : 0,
    link_interactions: eventType === "link.interacted" ? 1 : 0,
    errors_total: eventType === "error.reported" ? 1 : 0,
    errors_critical: eventType === "error.reported" && severity === "critical" ? 1 : 0,
  };
}

function bumpDemoActive(
  store: DemoTelemetryStore,
  date: string,
  actorUserId: string | null | undefined,
): number {
  if (!actorUserId) return 0;
  const key = `${APP_ID}:${date}`;
  const list = store.activeActorsByDay[key] ?? [];
  if (list.includes(actorUserId)) return 0;
  store.activeActorsByDay[key] = [...list, actorUserId];
  return 1;
}

/**
 * Emit one telemetry event and bump the matching daily rollup.
 * Demo mode uses localStorage; live uses supabaseAdmin (best-effort, never throws to callers).
 * @param input - event payload
 * @returns inserted TelemetryEvent or null on failure
 */
export async function emitTelemetryEvent(input: EmitTelemetryInput): Promise<TelemetryEvent | null> {
  const mode = input.mode ?? (typeof window !== "undefined" ? "demo" : "live");
  const occurred_at = input.occurred_at ?? new Date().toISOString();
  const event: TelemetryEvent = {
    id: makeId(),
    app_id: APP_ID,
    event_type: input.event_type,
    occurred_at,
    actor_user_id: input.actor_user_id ?? null,
    entity_type: input.entity_type ?? null,
    entity_id: input.entity_id ?? null,
    metadata: input.metadata ?? {},
    severity: input.severity ?? null,
  };

  if (mode === "demo") {
    return emitDemo(event, input);
  }

  try {
    return await emitLive(event, input);
  } catch (err) {
    console.error("[telemetry] emit failed", err);
    return null;
  }
}

function emitDemo(event: TelemetryEvent, input: EmitTelemetryInput): TelemetryEvent {
  const store = readDemoTelemetry();
  store.events = [event, ...store.events].slice(0, 5000);
  const date = utcDateKey(event.occurred_at);
  const { rollups, row } = ensureRollup(store.rollups, date);
  store.rollups = rollups;
  const deltas = rollupDeltas(event.event_type, event.severity);
  row.new_users += deltas.new_users;
  row.content_created += deltas.content_created;
  row.content_updated += deltas.content_updated;
  row.links_created += deltas.links_created;
  row.link_interactions += deltas.link_interactions;
  row.errors_total += deltas.errors_total;
  row.errors_critical += deltas.errors_critical;
  if (
    event.event_type === "content.created" ||
    event.event_type === "link.interacted" ||
    event.event_type === "content.updated"
  ) {
    row.active_users += bumpDemoActive(store, date, event.actor_user_id);
  }

  if (input.asErrorReport || event.event_type === "error.reported") {
    const report: AdminErrorReport = {
      id: makeId(),
      event_id: event.id,
      app_id: APP_ID,
      status: "new",
      message: input.errorMessage ?? String(event.metadata.message ?? "Error reported"),
      severity: event.severity ?? "error",
      actor_user_id: event.actor_user_id ?? null,
      metadata: event.metadata,
      created_at: occurredOrNow(event.occurred_at),
      updated_at: occurredOrNow(event.occurred_at),
      resolved_by: null,
      resolved_at: null,
    };
    store.errors = [report, ...store.errors].slice(0, 2000);
  }

  writeDemoTelemetry(store);
  return event;
}

function occurredOrNow(iso: string): string {
  return iso || new Date().toISOString();
}

async function emitLive(
  event: TelemetryEvent,
  input: EmitTelemetryInput,
): Promise<TelemetryEvent | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("telemetry_events")
    .insert({
      id: event.id,
      app_id: event.app_id,
      event_type: event.event_type,
      occurred_at: event.occurred_at,
      actor_user_id: event.actor_user_id,
      entity_type: event.entity_type,
      entity_id: event.entity_id,
      metadata: event.metadata as Json,
      severity: event.severity,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const deltas = rollupDeltas(event.event_type, event.severity);
  const date = utcDateKey(event.occurred_at);
  const activeBump =
    event.event_type === "content.created" ||
    event.event_type === "link.interacted" ||
    event.event_type === "content.updated"
      ? 1
      : 0;

  await supabaseAdmin.rpc("bump_telemetry_daily_rollup", {
    _app_id: APP_ID,
    _date: date,
    _new_users: deltas.new_users,
    _active_users: activeBump,
    _content_created: deltas.content_created,
    _content_updated: deltas.content_updated,
    _links_created: deltas.links_created,
    _link_interactions: deltas.link_interactions,
    _errors_total: deltas.errors_total,
    _errors_critical: deltas.errors_critical,
  });

  if (input.asErrorReport || event.event_type === "error.reported") {
    await supabaseAdmin.from("admin_error_reports").insert({
      event_id: event.id,
      app_id: APP_ID,
      status: "new",
      message: input.errorMessage ?? String(event.metadata.message ?? "Error reported"),
      severity: event.severity ?? "error",
      actor_user_id: event.actor_user_id,
      metadata: event.metadata as Json,
    });
  }

  return {
    id: data.id,
    app_id: data.app_id,
    event_type: data.event_type as TelemetryEvent["event_type"],
    occurred_at: data.occurred_at,
    actor_user_id: data.actor_user_id,
    entity_type: data.entity_type,
    entity_id: data.entity_id,
    metadata: (data.metadata ?? {}) as Record<string, string | number | boolean | null>,
    severity: data.severity as TelemetryEvent["severity"],
  };
}
