import type { DataMode } from "@/features/session";

/**
 * @responsibility Centralize social query keys so feed/post invalidation never drifts.
 * Key shapes match historical inline arrays (`["feed", mode]`, `["post", mode, id]`).
 * @pure true
 */
export const socialKeys = {
  feedRoot: ["feed"] as const,
  /**
   * @responsibility Build the feed query key for a data mode.
   */
  feed: (mode: DataMode) => ["feed", mode] as const,
  postRoot: ["post"] as const,
  /**
   * @responsibility Build the single-post query key for a data mode + id.
   */
  post: (mode: DataMode, postId: string) => ["post", mode, postId] as const,
  /** Root prefix used when invalidating any profile query. */
  profileRoot: ["profile"] as const,
  /** Root prefix used when invalidating notifications. */
  notificationsRoot: ["notifications"] as const,
};
