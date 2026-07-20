/**
 * Whole system status section: health cards + uptime history.
 *
 * Exports: SystemPage
 * Depends on: health queries
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminHealthHistoryQueryOptions, adminHealthQueryOptions } from "../../api/queries";
import { useAdminMode } from "../../hooks/useAdminMode";
import type { SystemHealthStatus } from "../../types/telemetry";

/**
 * System status admin section.
 * @returns system UI
 */
export function SystemPage(): React.ReactElement {
  const mode = useAdminMode();
  const health = useQuery(adminHealthQueryOptions(mode));
  const history = useQuery(adminHealthHistoryQueryOptions(mode));

  const days = useMemo(() => {
    const byDay = new Map<string, SystemHealthStatus>();
    for (const snap of history.data ?? []) {
      const day = snap.captured_at.slice(0, 10);
      const prev = byDay.get(day);
      byDay.set(day, worseStatus(prev ?? "operational", snap.status));
    }
    // Pad last 90 days
    const out: { date: string; status: SystemHealthStatus }[] = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      out.push({ date: key, status: byDay.get(key) ?? "operational" });
    }
    return out;
  }, [history.data]);

  const snap = health.data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">System status</h2>
        <p className="text-sm text-muted-foreground">
          Aggregate: <strong>{snap?.status ?? "…"}</strong> (worst-of this app)
        </p>
      </div>

      {health.isError ? (
        <p className="text-sm text-red-600">
          kinetic-canvas telemetry unreachable
          {health.dataUpdatedAt
            ? `, last seen ${new Date(health.dataUpdatedAt).toLocaleTimeString()}`
            : ""}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Status" value={snap?.status ?? "—"} />
        <Metric label="Uptime 24h" value={snap ? `${snap.uptime_pct_24h}%` : "—"} />
        <Metric label="p50 / p95" value={snap ? `${snap.p50_latency_ms} / ${snap.p95_latency_ms} ms` : "—"} />
        <Metric label="Error rate (5m)" value={snap ? `${snap.error_rate_pct}%` : "—"} />
      </div>

      {snap?.queue_depth != null ? (
        <p className="text-sm">Agent content queue depth: {snap.queue_depth}</p>
      ) : (
        <p className="text-sm text-muted-foreground">DB connection pool: N/A</p>
      )}

      <section>
        <h3 className="mb-2 text-sm font-medium">90-day uptime</h3>
        <div className="flex flex-wrap gap-0.5" role="img" aria-label="90 day uptime history">
          {days.map((d) => (
            <span
              key={d.date}
              title={`${d.date}: ${d.status}`}
              className={`size-2.5 rounded-[2px] ${statusColor(d.status)}`}
            />
          ))}
        </div>
        <p className="sr-only">
          {days.filter((d) => d.status !== "operational").length} non-operational days in window
        </p>
      </section>
    </div>
  );
}

function Metric(props: { label: string; value: string }): React.ReactElement {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs text-muted-foreground">{props.label}</p>
      <p className="mt-1 text-lg font-semibold">{props.value}</p>
    </div>
  );
}

function statusColor(status: SystemHealthStatus): string {
  if (status === "operational") return "bg-emerald-500";
  if (status === "degraded") return "bg-amber-400";
  if (status === "partial_outage") return "bg-orange-500";
  return "bg-red-600";
}

function worseStatus(a: SystemHealthStatus, b: SystemHealthStatus): SystemHealthStatus {
  const rank: Record<SystemHealthStatus, number> = {
    operational: 0,
    degraded: 1,
    partial_outage: 2,
    major_outage: 3,
  };
  return rank[a] >= rank[b] ? a : b;
}
