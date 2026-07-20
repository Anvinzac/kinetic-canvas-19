/**
 * Content section: created/updated series by entity_type + table.
 *
 * Exports: ContentPage
 * Depends on: events/rollups queries, recharts
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { adminEventsQueryOptions, adminRollupsQueryOptions } from "../../api/queries";
import { useAdminMode, useAdminSearchRange } from "../../hooks/useAdminMode";
import type { AdminRangePreset } from "../../lib/date-range";

/**
 * New data created by users.
 * @returns content UI
 */
export function ContentPage(): React.ReactElement {
  const search = useRouterState({
    select: (s) => (s.location.search ?? {}) as { range?: AdminRangePreset; from?: string; to?: string },
  });
  const mode = useAdminMode();
  const { from, to } = useAdminSearchRange(search);
  const rollups = useQuery(adminRollupsQueryOptions(from, to, mode));
  const events = useQuery(adminEventsQueryOptions(from, to, mode));
  const [entityFilter, setEntityFilter] = useState<string>("all");

  const contentEvents = useMemo(() => {
    const items = (events.data?.items ?? []).filter(
      (e) =>
        e.event_type === "content.created" ||
        e.event_type === "content.updated" ||
        e.event_type === "content.deleted",
    );
    if (entityFilter === "all") return items;
    return items.filter((e) => e.entity_type === entityFilter);
  }, [events.data, entityFilter]);

  const entityTypes = useMemo(() => {
    const set = new Set<string>();
    for (const e of events.data?.items ?? []) {
      if (e.entity_type && e.event_type.startsWith("content.")) set.add(e.entity_type);
    }
    return [...set].sort();
  }, [events.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">New data created</h2>
          <p className="text-sm text-muted-foreground">Posts, comments, and agent content</p>
        </div>
        <label className="text-xs text-muted-foreground">
          entity_type{" "}
          <select
            className="ml-1 rounded border border-border bg-background px-2 py-1 text-sm"
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
          >
            <option value="all">all</option>
            {entityTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="h-56 rounded-lg border border-border p-3">
        {(rollups.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No data in this range</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rollups.data}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="content_created" stackId="a" fill="#0f766e" name="created" />
              <Bar dataKey="content_updated" stackId="a" fill="#0369a1" name="updated" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">entity_type</th>
              <th className="px-3 py-2">entity_id</th>
              <th className="px-3 py-2">created_by</th>
              <th className="px-3 py-2">created_at</th>
            </tr>
          </thead>
          <tbody>
            {contentEvents.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-muted-foreground">
                  No data in this range
                </td>
              </tr>
            ) : (
              contentEvents.map((e) => (
                <tr key={e.id} className="border-b border-border/60">
                  <td className="px-3 py-2">{e.entity_type ?? "—"}</td>
                  <td className="px-3 py-2">
                    {e.entity_type === "post" && e.entity_id ? (
                      <a className="text-sky-700 underline" href={`/p/${e.entity_id}`}>
                        {e.entity_id.slice(0, 8)}…
                      </a>
                    ) : (
                      <span className="font-mono text-xs">{e.entity_id ?? "—"}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{e.actor_user_id ?? "—"}</td>
                  <td className="px-3 py-2">{new Date(e.occurred_at).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
