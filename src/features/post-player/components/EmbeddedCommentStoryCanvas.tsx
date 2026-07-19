/**
 * Inline comment-story canvas shown inside the comment tray.
 *
 * Exports: EmbeddedCommentStoryCanvas
 * Depends on: framer-motion, tanstack Link, lucide FastForward, comment-text, post-meta, AnimatedCommentStoryText
 */

import { motion } from "framer-motion";
import { FastForward } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { getCommentStoryGradient } from "../lib/comment-text";
import { formatShortDateTime } from "../lib/post-meta";
import type { CommentStory, Profile } from "../types";
import { AnimatedCommentStoryText } from "./AnimatedCommentStoryText";

export type EmbeddedCommentStoryCanvasProps = {
  story: CommentStory;
  author?: Profile;
  storyCount: number;
  storyIndex: number;
  storyPage: number;
  storyPageCount: number;
  pageText: string;
  playKey: number;
  fastMode: boolean;
  onToggleFast: () => void;
};

/**
 * @responsibility Compact story player embedded in the comment tray.
 */
export function EmbeddedCommentStoryCanvas({
  story,
  author,
  storyCount,
  storyIndex,
  storyPage,
  storyPageCount,
  pageText,
  playKey,
  fastMode,
  onToggleFast,
}: EmbeddedCommentStoryCanvasProps): ReactElement {
  const background = getCommentStoryGradient(story.index);

  return (
    <motion.div
      className="relative mx-auto aspect-[9/16] h-full max-h-full max-w-full overflow-hidden rounded-[24px] text-white shadow-[0_22px_64px_rgba(0,0,0,0.42)] ring-1 ring-white/15"
      initial={{ scale: 0.96 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
    >
      <div aria-hidden className="absolute inset-0" style={{ background }} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_15%,rgba(255,255,255,0.22),transparent_30%),linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.52))]" />

      <div className="absolute inset-x-3 top-3 z-20">
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
              className="flex h-9 min-w-0 items-center gap-2"
            >
              <img
                src={author.avatar_url ?? ""}
                alt=""
                className="size-9 shrink-0 rounded-full border-2 border-white/80"
              />
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-bold text-white drop-shadow">
                  @{author.username}
                </p>
                <p className="font-mono text-[9px] uppercase tracking-widest text-white/70 drop-shadow">
                  {formatShortDateTime(story.created_at)}
                </p>
              </div>
            </Link>
          ) : (
            <div className="flex h-9 items-center gap-2">
              <span className="size-9 rounded-full border-2 border-white/40 bg-white/15" />
              <div className="leading-tight">
                <p className="text-sm font-bold text-white drop-shadow">someone</p>
                <p className="font-mono text-[9px] uppercase tracking-widest text-white/70 drop-shadow">
                  {formatShortDateTime(story.created_at)}
                </p>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={onToggleFast}
            className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] backdrop-blur ${
              fastMode ? "bg-white text-black" : "bg-black/30 text-white"
            }`}
          >
            <FastForward className="size-3" />
            fast
          </button>
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
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-1">
          {Array.from({ length: storyPageCount }).map((_, index) => (
            <span
              key={index}
              className={`h-1 rounded-full transition ${
                index === storyPage ? "w-5 bg-white" : "w-1 bg-white/35"
              }`}
            />
          ))}
        </div>
      )}
    </motion.div>
  );

}
