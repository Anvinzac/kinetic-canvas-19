/**
 * Horizontal flying comment chip that dims the info block on overlap.
 *
 * Exports: FlyingCommentChip
 * Depends on: framer-motion, tanstack Link, comment-text, post-meta
 */

import { AnimatePresence, motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import type { Dispatch, ReactElement, SetStateAction } from "react";
import {
  getCommentFlightDuration,
  getFloatingCommentLabel,
} from "../lib/comment-text";
import { formatShortDateTime } from "../lib/post-meta";
import type { FlowComment, Profile } from "../types";

export type FlyingCommentChipProps = {
  isExporting: boolean;
  showingFlyingComment: boolean;
  activeComment: FlowComment | null;
  activeCommentLabel: string;
  activeCommentAuthor?: Profile;
  commentStartX: number;
  commentEndX: number;
  commentMaxWidth: number;
  commentOverlapEnterX: number;
  commentOverlapExitX: number;
  setCommentOverlapsInfo: Dispatch<SetStateAction<boolean>>;
};

/**
 * @responsibility Animate a short comment across the bottom of the canvas.
 */
export function FlyingCommentChip({
  isExporting,
  showingFlyingComment,
  activeComment,
  activeCommentLabel,
  activeCommentAuthor,
  commentStartX,
  commentEndX,
  commentMaxWidth,
  commentOverlapEnterX,
  commentOverlapExitX,
  setCommentOverlapsInfo,
}: FlyingCommentChipProps): ReactElement | null {
  if (isExporting) return null;

  return (
    <div className="pointer-events-none absolute bottom-2 left-1/2 z-20 flex w-full -translate-x-1/2 flex-col items-center gap-1 px-3 pb-4">
      <AnimatePresence mode="wait">
        {showingFlyingComment && activeComment && (
          <motion.div
            key={activeComment.key}
            initial={{ x: commentStartX }}
            animate={{ x: commentEndX }}
            exit={{ opacity: 0, transition: { duration: 0.18 } }}
            transition={{
              x: {
                duration:
                  getCommentFlightDuration(getFloatingCommentLabel(activeCommentLabel)) / 1000,
                ease: "linear",
              },
            }}
            onUpdate={(latest) => {
              const x =
                typeof latest.x === "number" ? latest.x : parseFloat(String(latest.x));
              const overlapping = x <= commentOverlapEnterX && x >= commentOverlapExitX;
              setCommentOverlapsInfo((prev) => (prev === overlapping ? prev : overlapping));
            }}
            onAnimationComplete={() => setCommentOverlapsInfo(false)}
            className="pointer-events-auto z-30 flex flex-col items-center gap-0.5"
            style={{ maxWidth: commentMaxWidth }}
          >
            <div className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-white/75">
              {activeCommentAuthor ? (
                <Link
                  to="/u/$username"
                  params={{ username: activeCommentAuthor.username }}
                  onClick={(event) => event.stopPropagation()}
                  className="font-bold text-white drop-shadow"
                >
                  @{activeCommentAuthor.username}
                </Link>
              ) : (
                <span className="drop-shadow">someone</span>
              )}
            </div>
            <div className="relative max-w-full rounded-2xl bg-white px-3 py-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.45)] ring-1 ring-black/5">
              <p className="text-center text-sm font-semibold leading-snug text-black">
                {getFloatingCommentLabel(activeCommentLabel)}
              </p>
            </div>
            <span className="font-mono text-[8px] uppercase tracking-wider text-white/50">
              {formatShortDateTime(activeComment.created_at)}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
