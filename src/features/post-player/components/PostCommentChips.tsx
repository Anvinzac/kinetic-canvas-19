/**
 * Comment tray: story preview, draft kinetic canvas, input, and quick chips.
 *
 * Exports: PostCommentChips
 * Depends on: framer-motion, lib/canvas COMMENT_CHIPS, kinetic-text getWords, comment-text, story canvases
 */

import { AnimatePresence, motion } from "framer-motion";
import type { ReactElement } from "react";
import { COMMENT_CHIPS } from "@/lib/canvas";
import { getWords } from "@/features/kinetic-text";
import { MAX_COMMENT_WORDS } from "../lib/comment-text";
import type { CommentStory, Profile } from "../types";
import { EmbeddedCommentStoryCanvas } from "./EmbeddedCommentStoryCanvas";
import { KineticCommentDraftCanvas } from "./KineticCommentDraftCanvas";

export type PostCommentChipsProps = {
  isExporting: boolean;
  showChips: boolean;
  showQuickCommentChips: boolean;
  customComment: string;
  normalizedCustomComment: string;
  customCommentHasText: boolean;
  customCommentIsKinetic: boolean;
  commentTrayStoryPlaying: boolean;
  activeStory: CommentStory | null;
  commentStories: CommentStory[];
  storyIndex: number;
  storyPage: number;
  storyPages: string[];
  storyPageText: string;
  storyPlayKey: number;
  storyFastMode: boolean;
  draftCommentPage: number;
  draftCommentPages: string[];
  draftCommentPageText: string;
  draftCommentPlayKey: number;
  draftCommentBackground: string;
  profilesById: Map<string, Profile>;
  setShowQuickCommentChips: (open: boolean) => void;
  setStoryFastMode: (updater: (fast: boolean) => boolean) => void;
  updateCustomComment: (value: string) => void;
  submitComment: (value: string) => void;
};

/**
 * @responsibility Bottom comment tray with story preview and chip picker.
 */
export function PostCommentChips({
  isExporting,
  showChips,
  showQuickCommentChips,
  customComment,
  normalizedCustomComment,
  customCommentHasText,
  customCommentIsKinetic,
  commentTrayStoryPlaying,
  activeStory,
  commentStories,
  storyIndex,
  storyPage,
  storyPages,
  storyPageText,
  storyPlayKey,
  storyFastMode,
  draftCommentPage,
  draftCommentPages,
  draftCommentPageText,
  draftCommentPlayKey,
  draftCommentBackground,
  profilesById,
  setShowQuickCommentChips,
  setStoryFastMode,
  updateCustomComment,
  submitComment,
}: PostCommentChipsProps): ReactElement {
  return (
    <AnimatePresence>
      {!isExporting && showChips && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="absolute inset-x-0 bottom-3 top-4 z-40 glass mx-3 flex flex-col justify-end rounded-[28px] p-3"
          onClick={(e) => e.stopPropagation()}
        >
          <AnimatePresence initial={false}>
            {commentTrayStoryPlaying && activeStory && (
              <motion.div
                key="existing-comment-story"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="mb-3 min-h-0 flex-1 overflow-hidden"
              >
                <EmbeddedCommentStoryCanvas
                  story={activeStory}
                  author={profilesById.get(activeStory.user_id)}
                  storyCount={commentStories.length}
                  storyIndex={storyIndex}
                  storyPage={storyPage}
                  storyPageCount={storyPages.length}
                  pageText={storyPageText}
                  playKey={storyPlayKey}
                  fastMode={storyFastMode}
                  onToggleFast={() => setStoryFastMode((fast) => !fast)}
                />
              </motion.div>
            )}
            {customCommentHasText && (
              <motion.div
                key="draft-comment-story"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="mb-3 min-h-0 flex-1 overflow-hidden"
              >
                <KineticCommentDraftCanvas
                  text={normalizedCustomComment}
                  pageText={draftCommentPageText}
                  page={draftCommentPage}
                  pageCount={draftCommentPages.length}
                  playKey={draftCommentPlayKey}
                  background={draftCommentBackground}
                />
              </motion.div>
            )}
          </AnimatePresence>
          <form
            className="flex shrink-0 gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              submitComment(customComment);
            }}
          >
            <input
              value={customComment}
              onFocus={() => setShowQuickCommentChips(true)}
              onChange={(event) => {
                setShowQuickCommentChips(true);
                updateCustomComment(event.target.value);
              }}
              placeholder="write a comment"
              className="min-w-0 flex-1 rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-white/40 focus:ring-primary/70"
            />
            <button
              type="submit"
              disabled={!normalizedCustomComment}
              className="rounded-xl bg-white px-3 text-xs font-bold text-black transition disabled:opacity-40"
            >
              {customCommentIsKinetic ? "kinetic" : "send"}
            </button>
          </form>
          <AnimatePresence initial={false}>
            {showQuickCommentChips && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mb-2 mt-3 flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <span>quick flick</span>
                  <span>
                    {getWords(customComment).length}/{MAX_COMMENT_WORDS}
                  </span>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {COMMENT_CHIPS.map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => {
                        submitComment(chip.id);
                      }}
                      className="rounded-full bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20 active:scale-90"
                    >
                      <span className="mr-1">{chip.emoji}</span>
                      {chip.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
