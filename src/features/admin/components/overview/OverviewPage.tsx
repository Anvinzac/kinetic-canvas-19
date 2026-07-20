/**
 * Overview section: topline cards, activity feed, 7d sparklines.
 *
 * Exports: OverviewPage
 * Depends on: queries, recharts
 */

import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { useRouterState } from "@tanstack/react-router";
import {
  adminEventsQueryOptions,
  adminHealthQueryOptions,
  adminRollupsQueryOptions,
} from "../../api/queries";
import { useAdminMode, useAdminSearchRange } from "../../hooks/useAdminMode";
import type { AdminRangePreset } from "../../lib/date-range";
import { daysAgo } from "../../lib/date-range";

/**
 * Admin overview landing page.
 * @returns overview UI
 */
export function OverviewPage(): React.ReactElement {
  const search = useRouterState({
    select: (s) => (s.location.search ?? {}) as { range?: AdminRangePreset; from?: string; to?: string },
  });
  const mode = useAdminMode();
  const { from, to } = useAdminSearchRange(search);
  const sparkFrom = daysAgo(7);
  const rollups = useQuery(adminRollupsQueryOptions(from, to, mode));
  const spark = useQuery(adminRollupsQueryOptions(sparkFrom, to, mode));
  const events = useQuery(adminEventsQueryOptions(from, to, mode));
  const health = useQuery(adminHealthQueryOptions(mode));

  const rows = rollups.data ?? [];
  const totals = rows.reduce(
    (acc, r) => {
      acc.users += r.new_users;
      acc.content += r.content_created;
      acc.errors += r.errors_total;
      acc.links += r.link_interactions;
      return acc;
    },
    { users: 0, content: 0, errors: 0, links: 0 },
  );

  if (rollups.isLoading) {
    return <div className="h-40 animate-pulse rounded-lg bg-muted" aria-busy />;
  }

  if (rollups.isError) {
    return (
      <p className="text-sm text-red-600">
        Telemetry unreachable: {rollups.error instanceof Error ? rollups.error.message : "error"}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Live operating data</h2>
        <p className="text-sm text-muted-foreground">
          Status: {health.data?.status ?? "…"} · queue {health.data?.queue_depth ?? "n/a"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="New users" value={totals.users} />
        <StatCard label="Content created" value={totals.content} />
        <StatCard label="Link interactions" value={totals.links} />
        <StatCard label="Errors" value={totals.errors} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Spark title="New users (7d)" data={(spark.data ?? []).map((r) => ({ v: r.new_users }))} />
        <Spark
          title="Content (7d)"
          data={(spark.data ?? []).map((r) => ({ v: r.content_created }))}
        />
        <Spark title="Errors (7d)" data={(spark.data ?? []).map((r) => ({ v: r.errors_total }))} />
      </div>

      <section>
        <h3 className="mb-3 text-sm font-medium">Activity feed</h3>
        {(events.data?.items.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No data in this range</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {(events.data?.items ?? []).slice(0, 50).map((ev) => (
              <li key={ev.id} className="px-3 py-2 text-sm">
                <span className="font-medium">{ev.event_type}</span>
                {ev.entity_type ? (
                  <span className="text-muted-foreground"> · {ev.entity_type}</span>
                ) : null}
                <span className="float-right text-xs text-muted-foreground">
                  {new Date(ev.occurred_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard(props: { label: string; value: number }): React.ReactElement {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs text-muted-foreground">{props.label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{props.value}</p>
    </div>
  );
}

function Spark(props: { title: string; data: { v: number }[] }): React.ReactElement {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="mb-2 text-xs text-muted-foreground">{props.title}</p>
      {props.data.length === 0 ? (
        <p className="text-xs text-muted-foreground">No data in this range</p>
      ) : (
        <div className="h-16" role="img" aria-label={props.title}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={props.data}>
              <Area type="monotone" dataKey="v" stroke="currentColor" fill="currentColor" fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
