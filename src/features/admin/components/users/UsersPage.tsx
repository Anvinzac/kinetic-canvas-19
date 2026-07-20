/**
 * Users section: registration series + table + cohort-lite.
 *
 * Exports: UsersPage
 * Depends on: rollups/events queries, recharts
 */

import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { adminEventsQueryOptions, adminRollupsQueryOptions } from "../../api/queries";
import { useAdminMode, useAdminSearchRange } from "../../hooks/useAdminMode";
import type { AdminRangePreset } from "../../lib/date-range";
import { daysAgo } from "../../lib/date-range";

/**
 * New user registration admin section.
 * @returns users UI
 */
export function UsersPage(): React.ReactElement {
  const search = useRouterState({
    select: (s) =>
      (s.location.search ?? {}) as { range?: AdminRangePreset; from?: string; to?: string },
  });
  const mode = useAdminMode();
  const { from, to } = useAdminSearchRange(search);
  const rollups = useQuery(adminRollupsQueryOptions(from, to, mode));
  const events = useQuery(adminEventsQueryOptions(from, to, mode));

  const spanDays = Math.max(
    1,
    Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000),
  );
  const daysSinceTo = Math.round((Date.now() - Date.parse(`${to}T00:00:00Z`)) / 86400000);
  const priorTo = daysAgo(daysSinceTo + 1);
  const priorFrom = daysAgo(daysSinceTo + spanDays);
  const prior = useQuery(adminRollupsQueryOptions(priorFrom, priorTo, mode));

  const currentUsers = (rollups.data ?? []).reduce((s, r) => s + r.new_users, 0);
  const priorUsers = (prior.data ?? []).reduce((s, r) => s + r.new_users, 0);
  const delta =
    priorUsers === 0
      ? currentUsers > 0
        ? 100
        : 0
      : ((currentUsers - priorUsers) / priorUsers) * 100;

  const userEvents = (events.data?.items ?? []).filter((e) => e.event_type === "user.registered");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">New user registration</h2>
        <p className="text-sm text-muted-foreground">
          Cohort-lite: {currentUsers} this period vs {priorUsers} prior ({delta.toFixed(1)}%)
        </p>
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
              <Bar dataKey="new_users" fill="currentColor" name="New users" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">user_id</th>
              <th className="px-3 py-2">app</th>
              <th className="px-3 py-2">registered_at</th>
              <th className="px-3 py-2">source</th>
            </tr>
          </thead>
          <tbody>
            {userEvents.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-muted-foreground">
                  No data in this range
                </td>
              </tr>
            ) : (
              userEvents.map((e) => (
                <tr key={e.id} className="border-b border-border/60">
                  <td className="px-3 py-2 font-mono text-xs">{e.actor_user_id ?? "—"}</td>
                  <td className="px-3 py-2">{e.app_id}</td>
                  <td className="px-3 py-2">{new Date(e.occurred_at).toLocaleString()}</td>
                  <td className="px-3 py-2">{String(e.metadata.username ?? "—")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
