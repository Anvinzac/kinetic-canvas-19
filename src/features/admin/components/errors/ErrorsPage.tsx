/**
 * Error reports section with acknowledge/resolve actions and anomaly markers.
 *
 * Exports: ErrorsPage
 * Depends on: admin errors queries, demo/live status updates
 */

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DEMO_AUTH_USER_ID } from "@/features/session";
import { adminErrorsQueryOptions, adminRollupsQueryOptions } from "../../api/queries";
import { adminKeys } from "../../api/keys";
import { updateLiveErrorStatus } from "../../api/telemetry.functions";
import { updateErrorStatus } from "../../api/telemetry.core";
import { useAdminMode, useAdminSearchRange } from "../../hooks/useAdminMode";
import type { AdminRangePreset } from "../../lib/date-range";
import type { ErrorReportStatus, TelemetrySeverity } from "../../types/telemetry";

/**
 * Error reports admin section.
 * @returns errors UI
 */
export function ErrorsPage(): React.ReactElement {
  const search = useRouterState({
    select: (s) => (s.location.search ?? {}) as { range?: AdminRangePreset; from?: string; to?: string },
  });
  const mode = useAdminMode();
  const { from, to } = useAdminSearchRange(search);
  const [statusFilter, setStatusFilter] = useState<ErrorReportStatus | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<TelemetrySeverity | "all">("all");
  const qc = useQueryClient();

  const errors = useQuery(
    adminErrorsQueryOptions(from, to, mode, statusFilter === "all" ? undefined : statusFilter),
  );
  const rollups = useQuery(adminRollupsQueryOptions(from, to, mode));

  const items = useMemo(() => {
    let list = errors.data?.items ?? [];
    if (severityFilter !== "all") list = list.filter((e) => e.severity === severityFilter);
    return list;
  }, [errors.data, severityFilter]);

  const anomalyDays = useMemo(() => {
    const series = (rollups.data ?? []).map((r) => r.errors_total);
    if (series.length < 3) return new Set<string>();
    const mean = series.reduce((a, b) => a + b, 0) / series.length;
    const variance =
      series.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(series.length - 1, 1);
    const std = Math.sqrt(variance);
    const threshold = mean + 2 * std;
    return new Set((rollups.data ?? []).filter((r) => r.errors_total > threshold).map((r) => r.date));
  }, [rollups.data]);

  const mutation = useMutation({
    mutationFn: async (input: { id: string; status: ErrorReportStatus }) => {
      if (mode === "demo") {
        return updateErrorStatus({
          mode: "demo",
          id: input.id,
          status: input.status,
          actorUserId: DEMO_AUTH_USER_ID,
        });
      }
      return updateLiveErrorStatus({ data: input });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: adminKeys.all });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Error reports</h2>
        <p className="text-sm text-muted-foreground">Client/boundary errors with admin status writes</p>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <FilterSelect
          label="status"
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as ErrorReportStatus | "all")}
          options={["all", "new", "acknowledged", "resolved"]}
        />
        <FilterSelect
          label="severity"
          value={severityFilter}
          onChange={(v) => setSeverityFilter(v as TelemetrySeverity | "all")}
          options={["all", "info", "warn", "error", "critical"]}
        />
      </div>

      <div className="h-48 rounded-lg border border-border p-3">
        {(rollups.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No data in this range</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rollups.data}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="errors_total" name="errors">
                {(rollups.data ?? []).map((r) => (
                  <Cell
                    key={r.date}
                    fill={anomalyDays.has(r.date) ? "#dc2626" : "#78716c"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">severity</th>
              <th className="px-3 py-2">message</th>
              <th className="px-3 py-2">status</th>
              <th className="px-3 py-2">when</th>
              <th className="px-3 py-2">actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-muted-foreground">
                  No data in this range
                </td>
              </tr>
            ) : (
              items.map((e) => (
                <tr key={e.id} className="border-b border-border/60">
                  <td className="px-3 py-2">{e.severity}</td>
                  <td className="max-w-xs truncate px-3 py-2">{e.message}</td>
                  <td className="px-3 py-2">{e.status}</td>
                  <td className="px-3 py-2 text-xs">{new Date(e.created_at).toLocaleString()}</td>
                  <td className="space-x-1 px-3 py-2">
                    {e.status === "new" ? (
                      <button
                        type="button"
                        className="rounded bg-muted px-2 py-1 text-xs"
                        disabled={mutation.isPending}
                        onClick={() => mutation.mutate({ id: e.id, status: "acknowledged" })}
                      >
                        Ack
                      </button>
                    ) : null}
                    {e.status !== "resolved" ? (
                      <button
                        type="button"
                        className="rounded bg-foreground px-2 py-1 text-xs text-background"
                        disabled={mutation.isPending}
                        onClick={() => mutation.mutate({ id: e.id, status: "resolved" })}
                      >
                        Resolve
                      </button>
                    ) : null}
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

function FilterSelect(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}): React.ReactElement {
  return (
    <label className="text-muted-foreground">
      {props.label}{" "}
      <select
        className="rounded border border-border bg-background px-2 py-1"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      >
        {props.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
