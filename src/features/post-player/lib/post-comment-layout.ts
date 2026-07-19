/**
 * Flying-comment lane geometry from canvas width.
 *
 * Exports: getCommentFlightGeometry
 * Depends on: comment-text CHIP_EXIT_PAD
 */

import { CHIP_EXIT_PAD } from "./comment-text";

export type CommentFlightGeometry = {
  commentMaxWidth: number;
  commentStartX: number;
  commentEndX: number;
  commentOverlapEnterX: number;
  commentOverlapExitX: number;
};

/**
 * Derive chip flight bounds so comments clear the info block.
 * @param canvasWidth - canvasWidth argument
 * @returns Computed value
 */
export function getCommentFlightGeometry(canvasWidth: number): CommentFlightGeometry {
  const commentLaneWidth = Math.max(180, canvasWidth - 96);
  const commentMaxWidth = Math.min(commentLaneWidth * 0.78, 290);
  const commentTravelHalf = (canvasWidth + commentMaxWidth) / 2 + CHIP_EXIT_PAD;
  const commentInfoRightEdge = -canvasWidth / 2 + 16 + Math.min(canvasWidth * 0.7, 260);
  const commentInfoLeftEdge = -canvasWidth / 2 + 16;
  return {
    commentMaxWidth,
    commentStartX: commentTravelHalf,
    commentEndX: -commentTravelHalf,
    commentOverlapEnterX: commentInfoRightEdge + commentMaxWidth / 2,
    commentOverlapExitX: commentInfoLeftEdge - commentMaxWidth / 2,
  };
}
