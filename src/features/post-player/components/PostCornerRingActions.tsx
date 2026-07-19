/**
 * Outer-ring create / like / share buttons for the corner dock.
 *
 * Exports: PostCornerRingActions
 * Depends on: framer-motion, lucide, tanstack Link, sonner, ring-geometry, post-meta
 */

import { motion } from "framer-motion";
import { Heart, Plus, Share2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import type { PointerEvent as ReactPointerEvent, ReactElement, ReactNode } from "react";
import {
  ARC_BUTTON_TAP,
  ARC_BUTTON_TAP_TRANSITION,
  RING_BUTTON_ANGLES,
  ringButtonOffset,
} from "../lib/ring-geometry";
import { formatCompactCount } from "../lib/post-meta";
import type { Profile } from "../types";

export type PostCornerRingActionsProps = {
  liked: boolean;
  likes: number;
  author?: Profile;
  postUrl: string;
  onLikePointerDown: (e: ReactPointerEvent) => void;
  onLikePointerUp: (e: ReactPointerEvent) => void;
  onLikePointerCancel: () => void;
};

/**
 * @responsibility Position create/like/share on the corner dock outer ring.
 */
export function PostCornerRingActions({
  liked,
  likes,
  author,
  postUrl,
  onLikePointerDown,
  onLikePointerUp,
  onLikePointerCancel,
}: PostCornerRingActionsProps): ReactElement {
  const ringActions: { key: string; el: ReactNode }[] = [
    {
      key: "create",
      el: (
        <motion.div
          whileTap={{ ...ARC_BUTTON_TAP, backgroundColor: "rgba(255,255,255,0.12)" }}
          transition={ARC_BUTTON_TAP_TRANSITION}
          className="grid size-10 place-items-center rounded-full text-white [filter:drop-shadow(0_1px_3px_rgba(0,0,0,0.7))]"
        >
          <Link
            to="/create"
            onClick={(e) => e.stopPropagation()}
            aria-label="Create"
            className="grid size-full place-items-center"
          >
            <Plus className="size-5" strokeWidth={2.5} />
          </Link>
        </motion.div>
      ),
    },
    {
      key: "like",
      el: (
        <motion.button
          type="button"
          whileTap={{ ...ARC_BUTTON_TAP, backgroundColor: "rgba(255,255,255,0.12)" }}
          transition={ARC_BUTTON_TAP_TRANSITION}
          onPointerDown={onLikePointerDown}
          onPointerUp={onLikePointerUp}
          onPointerCancel={onLikePointerCancel}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Like (hold to save to collection)"
          aria-pressed={liked}
          className="grid size-10 touch-none place-items-center rounded-full [filter:drop-shadow(0_1px_3px_rgba(0,0,0,0.7))]"
        >
          <span className="relative grid size-7 place-items-center">
            <Heart
              className={`absolute inset-0 size-7 transition ${
                liked
                  ? "scale-105 fill-[var(--color-magenta)] text-[var(--color-magenta)]"
                  : "fill-black/15 text-white/80"
              }`}
              strokeWidth={liked ? 1.2 : 0.9}
            />
            {likes > 0 && (
              <span
                className="relative mt-0.5 max-w-[1.8rem] truncate text-center font-mono text-[10px] font-black leading-none text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]"
                style={{ fontSize: 10 }}
              >
                {formatCompactCount(likes)}
              </span>
            )}
          </span>
        </motion.button>
      ),
    },
    {
      key: "share",
      el: (
        <motion.button
          type="button"
          whileTap={{ ...ARC_BUTTON_TAP, backgroundColor: "rgba(255,255,255,0.12)" }}
          transition={ARC_BUTTON_TAP_TRANSITION}
          onClick={async (e) => {
            e.stopPropagation();
            try {
              if (navigator.share) {
                await navigator.share({
                  title: author ? `${author.display_name} on Kinetic` : "Kinetic status",
                  url: postUrl,
                });
              } else {
                await navigator.clipboard.writeText(postUrl);
                toast.success("post link copied");
              }
            } catch (error) {
              if ((error as Error).name !== "AbortError") toast.error("could not share post");
            }
          }}
          aria-label="Share"
          className="grid size-10 place-items-center rounded-full text-white [filter:drop-shadow(0_1px_3px_rgba(0,0,0,0.7))]"
        >
          <Share2 className="size-5" />
        </motion.button>
      ),
    },
  ];

  return (
    <>
      {ringActions.map((action, index) => {
        const { right, bottom } = ringButtonOffset(
          RING_BUTTON_ANGLES[index] ?? RING_BUTTON_ANGLES[0],
        );
        return (
          <div key={action.key} className="absolute" style={{ right, bottom }}>
            {action.el}
          </div>
        );
      })}
    </>
  );
}
