/**
 * Module providing DataMode, resolveDataMode, dataModeKey.
 *
 * Exports: DataMode, resolveDataMode, dataModeKey
 * Depends on: ./demo-session
 */

import { isDemoSession } from "./demo-session";

export type DataMode = "demo" | "live";

/**
 * Choose whether data should come from the mock store or live serverFns.
 * @returns `"demo"` when a demo session is active, otherwise `"live"`
 */
export function resolveDataMode(): DataMode {
  return isDemoSession() ? "demo" : "live";
}

/**
 * Convert a data mode into the query-key segment used across the app.
 * @param mode - mode argument
 * @returns `"demo"` | `"live"` string segment (identical to historical inline keys)
 */
export function dataModeKey(mode: DataMode = resolveDataMode()): DataMode {
  return mode;
}
