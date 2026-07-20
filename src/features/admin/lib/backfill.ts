/**
 * One-shot backfill of telemetry from existing social rows (live) or demo seed.
 *
 * Exports: backfillTelemetryFromSources, seedDemoTelemetryFromMock
 * Depends on: emit helpers, demo seed, supabase admin
 */

import { MOCK_ME_ID, MOCK_PROFILES, MOCK_POSTS, MOCK_LIKES, MOCK_COMMENTS } from "@/features/demo/seed";
import { emptyDemoStore, ensureRollup, utcDateKey, writeDemoTelemetry } from "./demo-store";
import { makeId } from "./emit";
import {
  APP_ID,
  type DailyRollup,
  type TelemetryEvent,
  type TelemetryEventType,
} from "../types/telemetry";

function pushEvent(
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

function applyRollup(
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

  // Sample error for Errors section smoke
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

/**
 * Backfill live telemetry from profiles/posts/likes/comments (service role).
 * Skips if events already exist for this app.
 * @returns counts written
 */
export async function backfillTelemetryFromSources(): Promise<{ events: number; skipped: boolean }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("telemetry_events")
    .select("*", { count: "exact", head: true })
    .eq("app_id", APP_ID);
  if ((count ?? 0) > 0) return { events: 0, skipped: true };

  const [{ data: profiles }, { data: posts }, { data: likes }, { data: comments }] =
    await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, username, created_at, is_system")
        .eq("is_system", false),
      supabaseAdmin.from("posts").select("id, author_id, created_at, post_type"),
      supabaseAdmin.from("likes").select("user_id, post_id, created_at"),
      supabaseAdmin.from("comments").select("id, user_id, post_id, created_at, chip_id"),
    ]);

  const rows: Array<Record<string, unknown>> = [];
  for (const p of profiles ?? []) {
    rows.push({
      app_id: APP_ID,
      event_type: "user.registered",
      occurred_at: p.created_at,
      actor_user_id: p.id,
      entity_type: "profile",
      entity_id: p.id,
      metadata: { username: p.username },
    });
  }
  for (const post of posts ?? []) {
    rows.push({
      app_id: APP_ID,
      event_type: "content.created",
      occurred_at: post.created_at,
      actor_user_id: post.author_id,
      entity_type: "post",
      entity_id: post.id,
      metadata: { post_type: post.post_type },
    });
    rows.push({
      app_id: APP_ID,
      event_type: "link.created",
      occurred_at: post.created_at,
      actor_user_id: post.author_id,
      entity_type: "post",
      entity_id: post.id,
      metadata: { path: `/p/${post.id}` },
    });
  }
  for (const like of likes ?? []) {
    rows.push({
      app_id: APP_ID,
      event_type: "link.interacted",
      occurred_at: like.created_at,
      actor_user_id: like.user_id,
      entity_type: "post",
      entity_id: like.post_id,
      metadata: { interaction: "like" },
    });
  }
  for (const comment of comments ?? []) {
    rows.push({
      app_id: APP_ID,
      event_type: "content.created",
      occurred_at: comment.created_at,
      actor_user_id: comment.user_id,
      entity_type: "comment",
      entity_id: comment.id,
      metadata: { post_id: comment.post_id, chip_id: comment.chip_id },
    });
    rows.push({
      app_id: APP_ID,
      event_type: "link.interacted",
      occurred_at: comment.created_at,
      actor_user_id: comment.user_id,
      entity_type: "post",
      entity_id: comment.post_id,
      metadata: { interaction: "comment" },
    });
  }

  const chunk = 200;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const { error } = await supabaseAdmin.from("telemetry_events").insert(slice as never);
    if (error) throw new Error(error.message);
  }

  // Rebuild daily rollups from inserted events
  const { data: allEvents } = await supabaseAdmin
    .from("telemetry_events")
    .select("event_type, occurred_at, actor_user_id, severity")
    .eq("app_id", APP_ID);
  const map = new Map<string, DailyRollup>();
  const activeSeen = new Set<string>();
  for (const ev of allEvents ?? []) {
    const date = utcDateKey(ev.occurred_at);
    const row =
      map.get(date) ??
      ({
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
      } satisfies DailyRollup);
    const t = ev.event_type as TelemetryEventType;
    if (t === "user.registered") row.new_users += 1;
    if (t === "content.created") row.content_created += 1;
    if (t === "content.updated") row.content_updated += 1;
    if (t === "link.created") row.links_created += 1;
    if (t === "link.interacted") row.link_interactions += 1;
    if (t === "error.reported") {
      row.errors_total += 1;
      if (ev.severity === "critical") row.errors_critical += 1;
    }
    if (
      (t === "content.created" || t === "link.interacted") &&
      ev.actor_user_id
    ) {
      const key = `${date}:${ev.actor_user_id}`;
      if (!activeSeen.has(key)) {
        activeSeen.add(key);
        row.active_users += 1;
      }
    }
    map.set(date, row);
  }
  const rollupRows = [...map.values()];
  if (rollupRows.length) {
    await supabaseAdmin.from("telemetry_daily_rollups").upsert(rollupRows, {
      onConflict: "app_id,date",
    });
  }

  return { events: rows.length, skipped: false };
}
