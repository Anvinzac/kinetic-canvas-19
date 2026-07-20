/**
 * One-shot live backfill of telemetry from profiles/posts/likes/comments.
 *
 * Exports: backfillTelemetryFromSources
 * Depends on: supabase admin, demo-store utcDateKey, types
 */

import { utcDateKey } from "./demo-store";
import { APP_ID, type DailyRollup, type TelemetryEventType } from "../types/telemetry";

/**
 * Backfill live telemetry from social tables (service role).
 * Skips if events already exist for this app.
 * @returns counts written and whether the run was skipped
 */
export async function backfillTelemetryFromSources(): Promise<{
  events: number;
  skipped: boolean;
}> {
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
    if ((t === "content.created" || t === "link.interacted") && ev.actor_user_id) {
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
