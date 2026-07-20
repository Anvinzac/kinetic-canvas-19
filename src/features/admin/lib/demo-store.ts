/**
 * In-memory / localStorage demo telemetry store for offline admin.
 *
 * Exports: readDemoTelemetry, writeDemoTelemetry, DemoTelemetryStore, emptyDemoStore, utcDateKey
 * Depends on: admin telemetry types
 */

import type {
  AdminErrorReport,
  DailyRollup,
  SystemHealthSnapshot,
  TelemetryEvent,
} from "../types/telemetry";
import { APP_ID } from "../types/telemetry";

const STORAGE_KEY = "kinetic.admin.telemetry.v1";

export type DemoTelemetryStore = {
  events: TelemetryEvent[];
  rollups: DailyRollup[];
  errors: AdminErrorReport[];
  healthHistory: SystemHealthSnapshot[];
  accessLog: Array<{ id: string; actor_user_id: string | null; path: string; method: string; occurred_at: string }>;
  activeActorsByDay: Record<string, string[]>;
};

/**
 * Build an empty demo telemetry store.
 * @returns Empty store
 */
export function emptyDemoStore(): DemoTelemetryStore {
  return {
    events: [],
    rollups: [],
    errors: [],
    healthHistory: [],
    accessLog: [],
    activeActorsByDay: {},
  };
}

/**
 * UTC calendar day key YYYY-MM-DD.
 * @param iso - ISO timestamp
 * @returns date key
 */
export function utcDateKey(iso: string = new Date().toISOString()): string {
  return iso.slice(0, 10);
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

/**
 * Read demo telemetry from localStorage (client) or empty on server.
 * @returns Demo store
 */
export function readDemoTelemetry(): DemoTelemetryStore {
  const raw = storage()?.getItem(STORAGE_KEY);
  if (!raw) return emptyDemoStore();
  try {
    return { ...emptyDemoStore(), ...(JSON.parse(raw) as Partial<DemoTelemetryStore>) };
  } catch {
    return emptyDemoStore();
  }
}

/**
 * Persist demo telemetry store.
 * @param store - full store
 * @returns void
 */
export function writeDemoTelemetry(store: DemoTelemetryStore): void {
  storage()?.setItem(STORAGE_KEY, JSON.stringify(store));
}

/**
 * Ensure a rollup row exists for a date and return a mutable copy list.
 * @param rollups - existing rollups
 * @param date - YYYY-MM-DD
 * @returns updated rollups array + the row
 */
export function ensureRollup(
  rollups: DailyRollup[],
  date: string,
): { rollups: DailyRollup[]; row: DailyRollup } {
  const existing = rollups.find((r) => r.date === date && r.app_id === APP_ID);
  if (existing) return { rollups, row: existing };
  const row: DailyRollup = {
    app_id: APP_ID,
    date,
    new_users: 0,
    active_users: 0,
    content_created: 0,
    content_updated: 0,
    links_created: 0,
    link_interactions: 0,
    errors_total: 0,
    errors_critical: 0,
  };
  return { rollups: [...rollups, row], row };
}
