/**
 * Pure helpers for comment tray chronological lists and submit/preview.
 *
 * Exports: mergeChronologicalComments, filterFloatingComments, buildCommentFlowKey,
 *   isValidCommentSubmission, buildLocalComment, buildManualFlyComment
 * Depends on: kinetic-text getWords, comment-text helpers, Comment/FlowComment types
 */

import { getWords } from "@/features/kinetic-text";
import {
  MAX_COMMENT_CHARS,
  MAX_COMMENT_WORDS,
  getCommentFlightDuration,
  getCommentLabel,
  getFloatingCommentLabel,
  normalizeComment,
  shouldFloatComment,
} from "./comment-text";
import type { Comment, FlowComment } from "../types";

/**
 * Merge server + optimistic comments in created_at order.
 * @param comments - comments argument
 * @param localComments - localComments argument
 * @returns Function result
 */
export function mergeChronologicalComments(
  comments: Comment[],
  localComments: Comment[],
): Comment[] {
  return [...comments, ...localComments].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

/**
 * Keep only chips short enough to float across the canvas.
 * @param chronologicalComments - chronologicalComments argument
 * @returns Function result
 */
export function filterFloatingComments(chronologicalComments: Comment[]): Comment[] {
  return chronologicalComments.filter((comment) =>
    shouldFloatComment(getCommentLabel(comment.chip_id)),
  );
}

/**
 * Stable key so the float cycle restarts when the set changes.
 * @param floatingComments - floatingComments argument
 * @returns Computed value
 */
export function buildCommentFlowKey(floatingComments: Comment[]): string {
  return floatingComments
    .map((comment) => `${comment.id}:${comment.created_at}:${comment.chip_id}`)
    .join("|");
}

/**
 * Validate custom comment length / word limits before submit.
 * @param value - value argument
 * @returns Boolean result
 */
export function isValidCommentSubmission(value: string): string | null {
  const normalized = normalizeComment(value);
  if (
    !normalized ||
    normalized.length > MAX_COMMENT_CHARS ||
    getWords(normalized).length > MAX_COMMENT_WORDS
  ) {
    return null;
  }
  return normalized;
}

/**
 * Build an optimistic local kinetic comment row.
 * @param postId - postId argument
 * @param userId - userId argument
 * @param chipId - chipId argument
 * @param localId - localId argument
 * @returns Computed value
 */
export function buildLocalComment(
  postId: string,
  userId: string,
  chipId: string,
  localId: number,
): Comment {
  return {
    id: `local-comment-${localId}`,
    post_id: postId,
    user_id: userId,
    chip_id: chipId,
    created_at: new Date().toISOString(),
  };
}

/**
 * Build a manual fly-by FlowComment and its hold duration ms.
 * @param chipId - chipId argument
 * @param userId - userId argument
 * @param flyId - flyId argument
 * @returns Computed value
 */
export function buildManualFlyComment(
  chipId: string,
  userId: string,
  flyId: number,
): { comment: FlowComment; holdMs: number } {
  const holdMs =
    getCommentFlightDuration(getFloatingCommentLabel(getCommentLabel(chipId))) + 700;
  return {
    comment: {
      key: `local-${flyId}`,
      chip: chipId,
      created_at: new Date().toISOString(),
      user_id: userId,
    },
    holdMs,
  };
}
