/**
 * Live connection indicator: green SSE, amber polling, red stale.
 *
 * Exports: LiveIndicator
 * Depends on: react
 */

import { useEffect, useState } from "react";

type LiveState = "sse" | "polling" | "stale";

type LiveIndicatorProps = {
  lastUpdatedAt: number | null;
  sseConnected: boolean;
};

/**
 * Show connection health for admin live data.
 * @param props - last update + sse flag
 * @returns indicator element
 */
export function LiveIndicator(props: LiveIndicatorProps): React.ReactElement {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, []);

  let state: LiveState = "polling";
  if (props.sseConnected) state = "sse";
  if (props.lastUpdatedAt != null && now - props.lastUpdatedAt > 120_000) state = "stale";

  const label =
    state === "sse" ? "Live (SSE)" : state === "polling" ? "Polling" : "Stale (>2m)";
  const color =
    state === "sse" ? "bg-emerald-500" : state === "polling" ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground" title={label}>
      <span className={`inline-block size-2 rounded-full ${color}`} aria-hidden />
      <span>{label}</span>
    </div>
  );
}
