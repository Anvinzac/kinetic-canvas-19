/**
 * TanStack Query key factories for this feature.
 *
 * Exports: discoveryKeys
 * Depends on: @/features/session
 */

import type { DataMode } from "@/features/session";

/**
 * @responsibility Centralize discovery/me/profile/notification query keys.
 * Shapes match historical inline arrays used across routes.
 * @pure true
 */
export const discoveryKeys = {
  discoverRoot: ["discover"] as const,
  discover: (mode: DataMode) => ["discover", mode] as const,
  searchRoot: ["search"] as const,
  search: (mode: DataMode, q: string) => ["search", mode, q] as const,
  meRoot: ["me"] as const,
  me: (mode: DataMode) => ["me", mode] as const,
  notificationsRoot: ["notifications"] as const,
  notifications: (mode: DataMode) => ["notifications", mode] as const,
  profileRoot: ["profile"] as const,
  profile: (username: string, mode: DataMode) => ["profile", username, mode] as const,
};
