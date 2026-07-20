/**
 * Canonical telemetry contract types for kinetic-canvas admin.
 *
 * Exports: APP_ID, TelemetryEventType, TelemetrySeverity, TelemetryEvent, DailyRollup,
 *   SystemHealthSnapshot, SystemHealthStatus, ErrorReportStatus, AdminErrorReport
 * Depends on: none
 */

export const APP_ID = "kinetic-canvas" as const;

export type TelemetryEventType =
  | "user.registered"
  | "content.created"
  | "content.updated"
  | "content.deleted"
  | "link.created"
  | "link.interacted"
  | "error.reported"
  | "system.heartbeat";

export type TelemetrySeverity = "info" | "warn" | "error" | "critical";

export type TelemetryEvent = {
  id: string;
  app_id: string;
  event_type: TelemetryEventType;
  occurred_at: string;
  actor_user_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata: Record<string, string | number | boolean | null>;
  severity?: TelemetrySeverity | null;
};

export type DailyRollup = {
  app_id: string;
  date: string;
  new_users: number;
  active_users: number;
  content_created: number;
  content_updated: number;
  links_created: number;
  link_interactions: number;
  errors_total: number;
  errors_critical: number;
};

export type SystemHealthStatus =
  | "operational"
  | "degraded"
  | "partial_outage"
  | "major_outage";

export type SystemHealthSnapshot = {
  app_id: string;
  captured_at: string;
  status: SystemHealthStatus;
  uptime_pct_24h: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  error_rate_pct: number;
  queue_depth?: number;
  db_connections_used?: number;
  db_connections_max?: number;
};

export type ErrorReportStatus = "new" | "acknowledged" | "resolved";

export type AdminErrorReport = {
  id: string;
  event_id: string | null;
  app_id: string;
  status: ErrorReportStatus;
  message: string;
  severity: TelemetrySeverity;
  actor_user_id: string | null;
  metadata: Record<string, string | number | boolean | null>;
  created_at: string;
  updated_at: string;
  resolved_by: string | null;
  resolved_at: string | null;
};
