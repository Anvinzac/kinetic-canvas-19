/**
 * Links & interactions section (shareable posts).
 *
 * Exports: LinksPage
 * Depends on: events/rollups, recharts
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { adminEventsQueryOptions, adminRollupsQueryOptions } from "../../api/queries";
import { useAdminMode, useAdminSearchRange } from "../../hooks/useAdminMode";
import type { AdminRangePreset } from "../../lib/date-range";

/**
 * Links & interaction counts for shareable posts.
 * @returns links UI
 */
export function LinksPage(): React.ReactElement {
  const search = useRouterState({
    select: (s) => (s.location.search ?? {}) as { range?: AdminRangePreset; from?: string; to?: string },
  });
  const mode = useAdminMode();
  const { from, to } = useAdminSearchRange(search);
  const rollups = useQuery(adminRollupsQueryOptions(from, to, mode));
  const events = useQuery(adminEventsQueryOptions(from, to, mode));

  const linkRows = useMemo(() => {
    const map = new Map<
      string,
      { link_id: string; created_at: string; created_by: string | null; interactions: number; last?: string }
    >();
    for (const e of events.data?.items ?? []) {
      if (e.event_type === "link.created" && e.entity_id) {
        map.set(e.entity_id, {
          link_id: e.entity_id,
          created_at: e.occurred_at,
          created_by: e.actor_user_id ?? null,
          interactions: map.get(e.entity_id)?.interactions ?? 0,
          last: map.get(e.entity_id)?.last,
        });
      }
      if (e.event_type === "link.interacted" && e.entity_id) {
      const prev = map.get(e.entity_id) ?? {
          link_id: e.entity_id,
          created_at: e.occurred_at,
          created_by: null as string | null,
          interactions: 0,
          last: undefined as string | undefined,
        };
        prev.interactions += 1;
        prev.last = e.occurred_at;
        map.set(e.entity_id, prev);
      }
    }
    return [...map.values()].sort((a, b) => b.interactions - a.interactions);
  }, [events.data]);

  const stacked = useMemo(() => {
    const byDay: Record<string, { date: string; like: number; comment: number }> = {};
    for (const e of events.data?.items ?? []) {
      if (e.event_type !== "link.interacted") continue;
      const day = e.occurred_at.slice(0, 10);
      byDay[day] ??= { date: day, like: 0, comment: 0 };
      const kind = String(e.metadata.interaction ?? "like");
      if (kind === "comment") byDay[day]!.comment += 1;
      else byDay[day]!.like += 1;
    }
    return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
  }, [events.data]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Links & interactions</h2>
        <p className="text-sm text-muted-foreground">
          Shareable post URLs (`/p/:id`) — likes and comments as interactions
        </p>
      </div>

      <div className="h-56 rounded-lg border border-border p-3">
        {stacked.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data in this range</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stacked}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="like" stackId="a" fill="#be123c" name="like" />
              <Bar dataKey="comment" stackId="a" fill="#1d4ed8" name="comment" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Aggregate interactions in range:{" "}
        {(rollups.data ?? []).reduce((s, r) => s + r.link_interactions, 0)}
      </p>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">link</th>
              <th className="px-3 py-2">created_by</th>
              <th className="px-3 py-2">created_at</th>
              <th className="px-3 py-2">interactions</th>
              <th className="px-3 py-2">last</th>
            </tr>
          </thead>
          <tbody>
            {linkRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-muted-foreground">
                  No data in this range
                </td>
              </tr>
            ) : (
              linkRows.slice(0, 50).map((row) => (
                <tr key={row.link_id} className="border-b border-border/60">
                  <td className="px-3 py-2">
                    <a className="text-sky-700 underline" href={`/p/${row.link_id}`}>
                      /p/{row.link_id.slice(0, 8)}…
                    </a>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{row.created_by ?? "—"}</td>
                  <td className="px-3 py-2">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2 tabular-nums">{row.interactions}</td>
                  <td className="px-3 py-2">
                    {row.last ? new Date(row.last).toLocaleString() : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
