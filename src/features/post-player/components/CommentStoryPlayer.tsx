/**
 * Full-screen swipeable comment story overlay.
 *
 * Exports: CommentStoryPlayer
 * Depends on: framer-motion, lucide, tanstack Link, comment-text, post-meta, AnimatedCommentStoryText
 */

import { motion, type PanInfo } from "framer-motion";
import { FastForward, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { getCommentStoryGradient } from "../lib/comment-text";
import { formatShortDateTime } from "../lib/post-meta";
import type { CommentStory, Profile } from "../types";
import { AnimatedCommentStoryText } from "./AnimatedCommentStoryText";

export type CommentStoryPlayerProps = {
  story: CommentStory;
  author?: Profile;
  storyCount: number;
  storyIndex: number;
  storyPage: number;
  storyPageCount: number;
  pageText: string;
  playKey: number;
  fastMode: boolean;
  onClose: () => void;
  onToggleFast: () => void;
  onDragEnd: (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => void;
};

/**
 * @responsibility Modal story player for longer kinetic comments.
 */
export function CommentStoryPlayer({
  story,
  author,
  storyCount,
  storyIndex,
  storyPage,
  storyPageCount,
  pageText,
  playKey,
  fastMode,
  onClose,
  onToggleFast,
  onDragEnd,
}: CommentStoryPlayerProps): ReactElement {
  const background = getCommentStoryGradient(story.index);

  return (
    <motion.div
      className="absolute inset-0 z-50 flex items-end justify-center bg-black/42 p-3 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(event) => event.stopPropagation()}
    >
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.18}
        onDragEnd={onDragEnd}
        initial={{ y: 48, scale: 0.94, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 48, scale: 0.94, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        className="relative aspect-[9/16] h-[85%] max-h-[85%] max-w-[92%] overflow-hidden rounded-[28px] text-white shadow-[0_24px_80px_rgba(0,0,0,0.55)] ring-1 ring-white/15"
      >
        <div aria-hidden className="absolute inset-0" style={{ background }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_15%,rgba(255,255,255,0.22),transparent_30%),linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.52))]" />

        <div className="absolute inset-x-4 top-4 z-20">
          <div className="mb-3 flex gap-1">
            {Array.from({ length: storyCount }).map((_, index) => (
              <span
                key={index}
                className={`h-1 flex-1 rounded-full ${
                  index === storyIndex ? "bg-white" : "bg-white/25"
                }`}
              />
            ))}
          </div>
          <div className="flex items-start justify-between gap-2">
            {author ? (
              <Link
                to="/u/$username"
                params={{ username: author.username }}
                onClick={(event) => event.stopPropagation()}
                className="flex h-10 min-w-0 items-center gap-2"
              >
                <img
                  src={author.avatar_url ?? ""}
                  alt=""
                  className="size-10 shrink-0 rounded-full border-2 border-white/80"
                />
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-sm font-bold text-white drop-shadow">
                    @{author.username}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-white/70 drop-shadow">
                    {formatShortDateTime(story.created_at)}
                  </p>
                </div>
              </Link>
            ) : (
              <div className="flex h-10 items-center gap-2">
                <span className="size-10 rounded-full border-2 border-white/40 bg-white/15" />
                <div className="leading-tight">
                  <p className="text-sm font-bold text-white drop-shadow">someone</p>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-white/70 drop-shadow">
                    {formatShortDateTime(story.created_at)}
                  </p>
                </div>
              </div>
            )}
            <div className="flex shrink-0 gap-2 pt-1">
              <button
                type="button"
                onClick={onToggleFast}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] backdrop-blur ${
                  fastMode ? "bg-white text-black" : "bg-black/30 text-white"
                }`}
              >
                <FastForward className="size-3" />
                fast
              </button>
              <button
                type="button"
                onClick={onClose}
                className="grid size-8 place-items-center rounded-full bg-black/35 text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)] ring-1 ring-white/20 backdrop-blur"
                aria-label="Close animated comments"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        </div>

        <AnimatedCommentStoryText
          text={pageText}
          fullText={story.text}
          playKey={playKey}
          fastMode={fastMode}
          background={background}
        />

        {!fastMode && storyPageCount > 1 && (
          <div className="absolute bottom-16 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
            {Array.from({ length: storyPageCount }).map((_, index) => (
              <span
                key={index}
                className={`h-1.5 rounded-full transition ${
                  index === storyPage ? "w-5 bg-white" : "w-1.5 bg-white/35"
                }`}
              />
            ))}
          </div>
        )}

        <p className="absolute inset-x-4 bottom-4 z-20 text-right font-mono text-[9px] uppercase tracking-[0.14em] text-white/55">
          swipe to skip
        </p>
      </motion.div>
    </motion.div>
  );

}
