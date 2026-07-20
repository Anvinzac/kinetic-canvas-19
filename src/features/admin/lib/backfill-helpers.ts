/**
 * Shared helpers for building telemetry events and bumping daily rollups.
 *
 * Exports: pushEvent, applyRollup
 * Depends on: demo-store ensureRollup, emit makeId, types
 */

import { ensureRollup, utcDateKey } from "./demo-store";
import { makeId } from "./emit";
import {
  APP_ID,
  type DailyRollup,
  type TelemetryEvent,
  type TelemetryEventType,
} from "../types/telemetry";

/**
 * Append a telemetry event with generated id/app_id.
 * @param events - mutable event list
 * @param partial - event fields without id/app_id
 * @returns the created event
 */
export function pushEvent(
  events: TelemetryEvent[],
  partial: Omit<TelemetryEvent, "id" | "app_id" | "metadata"> & {
    metadata?: Record<string, string | number | boolean | null>;
  },
): TelemetryEvent {
  const event: TelemetryEvent = {
    id: makeId(),
    app_id: APP_ID,
    metadata: partial.metadata ?? {},
    event_type: partial.event_type,
    occurred_at: partial.occurred_at,
    actor_user_id: partial.actor_user_id,
    entity_type: partial.entity_type,
    entity_id: partial.entity_id,
    severity: partial.severity ?? null,
  };
  events.push(event);
  return event;
}

/**
 * Mutate rollup counters for one event occurrence.
 * @param rollups - current rollup list
 * @param eventType - telemetry event type
 * @param occurredAt - ISO timestamp
 * @param activeActor - optional actor for active_users de-dupe
 * @param activeSeen - optional set keyed date:actor
 * @returns updated rollups array reference
 */
export function applyRollup(
  rollups: DailyRollup[],
  eventType: TelemetryEventType,
  occurredAt: string,
  activeActor?: string | null,
  activeSeen?: Set<string>,
): DailyRollup[] {
  const date = utcDateKey(occurredAt);
  const { rollups: next, row } = ensureRollup(rollups, date);
  if (eventType === "user.registered") row.new_users += 1;
  if (eventType === "content.created") row.content_created += 1;
  if (eventType === "link.created") row.links_created += 1;
  if (eventType === "link.interacted") row.link_interactions += 1;
  if (activeActor && activeSeen) {
    const key = `${date}:${activeActor}`;
    if (!activeSeen.has(key)) {
      activeSeen.add(key);
      row.active_users += 1;
    }
  }
  return next;
}
