/**
 * Bottom-right corner dock: comment hub plus outer ring actions.
 *
 * Exports: PostCornerDock
 * Depends on: framer-motion, lucide MessageCircle, ring-geometry, post-meta, PostCornerRingActions
 */

import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import type { PointerEvent as ReactPointerEvent, ReactElement } from "react";
import {
  ARC_BUTTON_TAP,
  ARC_BUTTON_TAP_TRANSITION,
  RING_DIVIDER_ANGLES,
  RING_DIVIDER_INSET,
  RING_HUB,
  RING_HUB_RADIUS,
  RING_OUTER,
  SHOW_CORNER_COMMENT_ACTION,
} from "../lib/ring-geometry";
import { formatCompactCount } from "../lib/post-meta";
import type { Profile } from "../types";
import { PostCornerRingActions } from "./PostCornerRingActions";

export type PostCornerDockProps = {
  isExporting: boolean;
  liked: boolean;
  likes: number;
  commentsCount: number;
  author?: Profile;
  postUrl: string;
  onToggleChips: () => void;
  onLikePointerDown: (e: ReactPointerEvent) => void;
  onLikePointerUp: (e: ReactPointerEvent) => void;
  onLikePointerCancel: () => void;
};

/**
 * @responsibility Corner action disc for comment / create / like / share.
 */
export function PostCornerDock({
  isExporting,
  liked,
  likes,
  commentsCount,
  author,
  postUrl,
  onToggleChips,
  onLikePointerDown,
  onLikePointerUp,
  onLikePointerCancel,
}: PostCornerDockProps): ReactElement | null {
  if (isExporting) return null;

  return (
    <motion.div
      key="actions"
      initial={{ opacity: 0, scale: 0.85, x: 18, y: 18 }}
      animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      className="absolute bottom-[env(safe-area-inset-bottom,0px)] right-[env(safe-area-inset-right,0px)] z-30 size-[148px]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          width: RING_OUTER * 2,
          height: RING_OUTER * 2,
          right: RING_HUB - RING_OUTER,
          bottom: RING_HUB - RING_OUTER,
        }}
      >
        <div className="absolute inset-0 rounded-full border border-white/12 bg-black/45 shadow-[0_14px_36px_rgba(0,0,0,0.4)] backdrop-blur-xl" />
        {RING_DIVIDER_ANGLES.map((phi) => (
          <div
            key={phi}
            className="absolute left-1/2 top-1/2 h-px origin-left bg-white/18 shadow-[0_0_2px_rgba(0,0,0,0.35)]"
            style={{
              width: RING_OUTER - RING_DIVIDER_INSET,
              transform: `rotate(${-(90 + phi)}deg) translateX(${RING_DIVIDER_INSET}px)`,
            }}
          />
        ))}
      </div>

      {SHOW_CORNER_COMMENT_ACTION && (
        <motion.button
          type="button"
          whileTap={{ ...ARC_BUTTON_TAP, backgroundColor: "rgba(255,255,255,0.12)" }}
          transition={ARC_BUTTON_TAP_TRANSITION}
          onClick={(e) => {
            e.stopPropagation();
            onToggleChips();
          }}
          aria-label="Comment"
          className="absolute grid place-items-center rounded-full bg-black/55 text-white ring-1 ring-white/15 backdrop-blur-md [filter:drop-shadow(0_1px_3px_rgba(0,0,0,0.7))]"
          style={{
            width: RING_HUB_RADIUS * 2,
            height: RING_HUB_RADIUS * 2,
            right: RING_HUB - RING_HUB_RADIUS,
            bottom: RING_HUB - RING_HUB_RADIUS,
          }}
        >
          <span className="relative grid size-8 -translate-x-2 -translate-y-2.5 place-items-center">
            <MessageCircle
              className="absolute inset-0 size-8 fill-black/15 text-white"
              strokeWidth={1.7}
            />
            {commentsCount > 0 && (
              <span
                className="relative -mt-0.5 max-w-[1.8rem] truncate text-center font-mono text-[10px] font-black leading-none text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]"
                style={{ fontSize: 10 }}
              >
                {formatCompactCount(commentsCount)}
              </span>
            )}
          </span>
        </motion.button>
      )}

      <PostCornerRingActions
        liked={liked}
        likes={likes}
        author={author}
        postUrl={postUrl}
        onLikePointerDown={onLikePointerDown}
        onLikePointerUp={onLikePointerUp}
        onLikePointerCancel={onLikePointerCancel}
      />
    </motion.div>
  );
}
