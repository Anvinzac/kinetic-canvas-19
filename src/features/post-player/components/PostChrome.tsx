/**
 * Author chip, overflow menu trigger, pause overlay, and menu rail.
 *
 * Exports: PostChrome
 * Depends on: framer-motion, lucide, tanstack Link, PostMenuRail
 */

import { AnimatePresence, motion } from "framer-motion";
import { MoreHorizontal, Play, RotateCcw } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { Dispatch, ReactElement, SetStateAction } from "react";
import type { Profile } from "../types";
import { PostMenuRail } from "./PostMenuRail";

export type PostChromeProps = {
  author?: Profile;
  postType: string;
  isExporting: boolean;
  actionMenuOpen: boolean;
  setActionMenuOpen: Dispatch<SetStateAction<boolean>>;
  isPaused: boolean;
  storyOpen: boolean;
  showCollectionPicker: boolean;
  onExport: () => void;
  resetCurrentPage: () => void;
  replayFromBeginning: () => void;
};

/**
 * Top chrome, overflow menu, and paused controls.
 * @param props - PostChromeProps fields
 * @returns Rendered UI
 */
export function PostChrome({
  author,
  postType,
  isExporting,
  actionMenuOpen,
  setActionMenuOpen,
  isPaused,
  storyOpen,
  showCollectionPicker,
  onExport,
  resetCurrentPage,
  replayFromBeginning,
}: PostChromeProps): ReactElement {
  return (
    <>
      {!isExporting && author && (
        <Link
          to="/u/$username"
          params={{ username: author.username }}
          className="absolute left-[max(1rem,env(safe-area-inset-left))] top-[max(1rem,env(safe-area-inset-top))] z-20 flex h-10 min-w-0 max-w-[calc(100%-5.5rem)] items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={author.avatar_url ?? ""}
            alt=""
            className="size-10 shrink-0 rounded-full border-2 border-white/80"
          />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-bold text-white drop-shadow">@{author.username}</p>
            <p className="text-[10px] uppercase tracking-widest text-white/70 drop-shadow">
              {postType}
            </p>
          </div>
        </Link>
      )}

      {!isExporting && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.88, backgroundColor: "rgba(255,255,255,0.12)" }}
          transition={{ type: "spring", stiffness: 400, damping: 24 }}
          onClick={(e) => {
            e.stopPropagation();
            setActionMenuOpen((open) => !open);
          }}
          className="absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] z-30 grid size-10 place-items-center rounded-full bg-black/40 text-white shadow-[0_12px_30px_rgba(0,0,0,0.3)] ring-1 ring-white/15 backdrop-blur"
          aria-label="More choices"
          aria-expanded={actionMenuOpen}
        >
          <MoreHorizontal className="size-5" />
        </motion.button>
      )}

      <AnimatePresence>
        {!isExporting && actionMenuOpen && (
          <PostMenuRail key="menu" onExport={onExport} isExporting={isExporting} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isExporting && isPaused && !storyOpen && !showCollectionPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 grid place-items-center bg-black/45 px-6 backdrop-blur-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full max-w-[260px] rounded-2xl bg-black/55 p-3 text-center ring-1 ring-white/15">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/60">
                paused
              </p>
              <div className="mt-3 grid gap-2">
                <button
                  type="button"
                  onClick={resetCurrentPage}
                  className="flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-black transition hover:bg-white/90"
                >
                  <RotateCcw className="size-4" />
                  reset page
                </button>
                <button
                  type="button"
                  onClick={replayFromBeginning}
                  className="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-bold text-white ring-1 ring-white/10 transition hover:bg-white/15"
                >
                  <Play className="size-4 fill-current" />
                  replay from beginning
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
