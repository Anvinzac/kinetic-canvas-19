/**
 * Seed demo admin telemetry from mock social seed data.
 *
 * Exports: seedDemoTelemetryFromMock
 * Depends on: demo seed, demo-store, backfill-helpers
 */

import { MOCK_ME_ID, MOCK_PROFILES, MOCK_POSTS, MOCK_LIKES, MOCK_COMMENTS } from "@/features/demo/seed";
import { applyRollup, pushEvent } from "./backfill-helpers";
import { emptyDemoStore, utcDateKey, writeDemoTelemetry } from "./demo-store";
import { makeId } from "./emit";
import { APP_ID, type DailyRollup, type TelemetryEvent } from "../types/telemetry";

/**
 * Seed demo admin telemetry from mock seed data (idempotent overwrite of empty store).
 * @returns number of events written
 */
export function seedDemoTelemetryFromMock(): number {
  const events: TelemetryEvent[] = [];
  let rollups: DailyRollup[] = [];
  const activeSeen = new Set<string>();

  for (const profile of MOCK_PROFILES) {
    if ((profile as { is_system?: boolean }).is_system) continue;
    pushEvent(events, {
      event_type: "user.registered",
      occurred_at: profile.created_at,
      actor_user_id: profile.id,
      entity_type: "profile",
      entity_id: profile.id,
      metadata: { username: profile.username },
    });
    rollups = applyRollup(rollups, "user.registered", profile.created_at);
  }

  for (const post of MOCK_POSTS) {
    pushEvent(events, {
      event_type: "content.created",
      occurred_at: post.created_at,
      actor_user_id: post.author_id,
      entity_type: "post",
      entity_id: post.id,
    });
    rollups = applyRollup(rollups, "content.created", post.created_at, post.author_id, activeSeen);
    pushEvent(events, {
      event_type: "link.created",
      occurred_at: post.created_at,
      actor_user_id: post.author_id,
      entity_type: "post",
      entity_id: post.id,
      metadata: { path: `/p/${post.id}` },
    });
    rollups = applyRollup(rollups, "link.created", post.created_at);
  }

  for (const like of MOCK_LIKES) {
    pushEvent(events, {
      event_type: "link.interacted",
      occurred_at: like.created_at,
      actor_user_id: like.user_id,
      entity_type: "post",
      entity_id: like.post_id,
      metadata: { interaction: "like" },
    });
    rollups = applyRollup(rollups, "link.interacted", like.created_at, like.user_id, activeSeen);
  }

  for (const comment of MOCK_COMMENTS) {
    pushEvent(events, {
      event_type: "content.created",
      occurred_at: comment.created_at,
      actor_user_id: comment.user_id,
      entity_type: "comment",
      entity_id: comment.id,
      metadata: { post_id: comment.post_id },
    });
    rollups = applyRollup(
      rollups,
      "content.created",
      comment.created_at,
      comment.user_id,
      activeSeen,
    );
    pushEvent(events, {
      event_type: "link.interacted",
      occurred_at: comment.created_at,
      actor_user_id: comment.user_id,
      entity_type: "post",
      entity_id: comment.post_id,
      metadata: { interaction: "comment" },
    });
    rollups = applyRollup(
      rollups,
      "link.interacted",
      comment.created_at,
      comment.user_id,
      activeSeen,
    );
  }

  const sampleErrorAt = new Date().toISOString();
  const errEvent = pushEvent(events, {
    event_type: "error.reported",
    occurred_at: sampleErrorAt,
    actor_user_id: MOCK_ME_ID,
    entity_type: "client",
    entity_id: null,
    severity: "error",
    metadata: { message: "Sample demo boundary error", boundary: "seed" },
  });
  rollups = applyRollup(rollups, "error.reported", sampleErrorAt);
  const errRow = rollups.find((r) => r.date === utcDateKey(sampleErrorAt));
  if (errRow) errRow.errors_total += 1;

  const store = emptyDemoStore();
  store.events = events.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  store.rollups = rollups.sort((a, b) => a.date.localeCompare(b.date));
  store.errors = [
    {
      id: makeId(),
      event_id: errEvent.id,
      app_id: APP_ID,
      status: "new",
      message: "Sample demo boundary error",
      severity: "error",
      actor_user_id: MOCK_ME_ID,
      metadata: errEvent.metadata,
      created_at: sampleErrorAt,
      updated_at: sampleErrorAt,
      resolved_by: null,
      resolved_at: null,
    },
  ];
  writeDemoTelemetry(store);
  return events.length;
}
