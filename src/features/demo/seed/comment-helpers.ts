/**
 * Small constructor for demo seed comment rows.
 *
 * Exports: comment
 * Depends on: MockComment type
 */

import type { MockComment } from "./types";

export function comment(
  id: string,
  post_id: string,
  user_id: string,
  chip_id: string,
  created_at: string,
): MockComment {
  return { id, post_id, user_id, chip_id, created_at };
}
