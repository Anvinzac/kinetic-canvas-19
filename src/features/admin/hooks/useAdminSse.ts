/**
 * Best-effort SSE client for admin live feed; falls back silently to polling.
 *
 * Exports: useAdminSse
 * Depends on: session demo header
 */

import { useEffect, useState } from "react";
import type { AdminMode } from "../api/queries";

/**
 * Attempt EventSource against /api/admin/telemetry/stream.
 * @param mode - demo|live
 * @returns { connected }
 */
export function useAdminSse(mode: AdminMode): { connected: boolean } {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let es: EventSource | null = null;
    let cancelled = false;

    async function connect() {
      try {
        // EventSource cannot set custom headers; demo uses query flag for handshake probe only.
        // Full auth SSE is best-effort; polling remains source of truth.
        const url =
          mode === "demo"
            ? "/api/admin/telemetry/stream?demo=1"
            : "/api/admin/telemetry/stream";
        es = new EventSource(url);
        es.addEventListener("ready", () => {
          if (!cancelled) setConnected(true);
        });
        es.onerror = () => {
          setConnected(false);
          es?.close();
        };
      } catch {
        setConnected(false);
      }
    }

    void connect();
    return () => {
      cancelled = true;
      es?.close();
    };
  }, [mode]);

  return { connected };
}
