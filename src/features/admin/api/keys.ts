/**
 * Admin query keys for TanStack Query.
 *
 * Exports: adminKeys
 * Depends on: none
 */

export const adminKeys = {
  all: ["admin"] as const,
  rollups: (from: string, to: string, mode: string) =>
    [...adminKeys.all, "rollups", from, to, mode] as const,
  events: (from: string, to: string, mode: string) =>
    [...adminKeys.all, "events", from, to, mode] as const,
  health: (mode: string) => [...adminKeys.all, "health", mode] as const,
  healthHistory: (mode: string) => [...adminKeys.all, "healthHistory", mode] as const,
  errors: (from: string, to: string, mode: string, status?: string) =>
    [...adminKeys.all, "errors", from, to, mode, status ?? "all"] as const,
};
