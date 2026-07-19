/**
 * Small constructor for demo seed comment rows.
 *
 * Exports: comment
 * Depends on: MockComment type
 */

import type { MockComment } from "./types";

/**
 * comment helper
 * @param id - id argument
 * @param post_id - post_id argument
 * @param user_id - user_id argument
 * @param chip_id - chip_id argument
 * @param created_at - created_at argument
 * @returns Function result
 */
export function comment(
  id: string,
  post_id: string,
  user_id: string,
  chip_id: string,
  created_at: string,
): MockComment {
  return { id, post_id, user_id, chip_id, created_at };
}
