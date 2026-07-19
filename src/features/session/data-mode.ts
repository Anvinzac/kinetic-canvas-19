import { isDemoSession } from "./demo-session";

export type DataMode = "demo" | "live";

/**
 * @responsibility Choose whether data should come from the mock store or live serverFns.
 * @outputs `"demo"` when a demo session is active, otherwise `"live"`
 * @pure false — depends on localStorage demo session
 */
export function resolveDataMode(): DataMode {
  return isDemoSession() ? "demo" : "live";
}

/**
 * @responsibility Convert a data mode into the query-key segment used across the app.
 * @inputs data mode
 * @outputs `"demo"` | `"live"` string segment (identical to historical inline keys)
 * @pure true
 */
export function dataModeKey(mode: DataMode = resolveDataMode()): DataMode {
  return mode;
}
