/**
 * Kinetic comment-story playback state (index, page, fast mode).
 *
 * Exports: useCommentStory
 * Depends on: comment-text getCommentLabel/shouldFloatComment/getCommentStoryPages
 */

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { PanInfo } from "framer-motion";
import {
  getCommentLabel,
  getCommentStoryPages,
  shouldFloatComment,
} from "../lib/comment-text";
import type { Comment, CommentStory } from "../types";

export type UseCommentStoryArgs = {
  chronologicalComments: Comment[];
  showChips: boolean;
  customCommentHasText: boolean;
};

export type UseCommentStoryResult = {
  commentStories: CommentStory[];
  storyOpen: boolean;
  setStoryOpen: Dispatch<SetStateAction<boolean>>;
  storyIndex: number;
  setStoryIndex: Dispatch<SetStateAction<number>>;
  storyPage: number;
  setStoryPage: Dispatch<SetStateAction<number>>;
  storyPlayKey: number;
  setStoryPlayKey: Dispatch<SetStateAction<number>>;
  storyFastMode: boolean;
  setStoryFastMode: Dispatch<SetStateAction<boolean>>;
  activeStory: CommentStory | null;
  storyPages: string[];
  storyPageText: string;
  commentTrayStoryPlaying: boolean;
  storyPlayerActive: boolean;
  openCommentStories: () => void;
  closeCommentStories: (setIsPaused: (v: boolean) => void, setPageRevealed: (v: boolean) => void) => void;
  skipCommentStory: (direction: 1 | -1) => void;
  handleStoryDrag: (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => void;
};

/**
 * @responsibility Track which kinetic comment story is playing and its page.
 */
export function useCommentStory({
  chronologicalComments,
  showChips,
  customCommentHasText,
}: UseCommentStoryArgs): UseCommentStoryResult {
  const commentStories = useMemo(
    () =>
      chronologicalComments
        .filter((comment) => !shouldFloatComment(getCommentLabel(comment.chip_id)))
        .map((comment, index) => ({
          id: comment.id,
          text: getCommentLabel(comment.chip_id),
          created_at: comment.created_at,
          index,
          user_id: comment.user_id,
        })),
    [chronologicalComments],
  );

  const [storyOpen, setStoryOpen] = useState(false);
  const [storyIndex, setStoryIndex] = useState(0);
  const [storyPage, setStoryPage] = useState(0);
  const [storyPlayKey, setStoryPlayKey] = useState(0);
  const [storyFastMode, setStoryFastMode] = useState(false);

  const activeStory = commentStories[storyIndex] ?? null;
  const storyPages = useMemo(
    () => (activeStory ? getCommentStoryPages(activeStory.text, storyFastMode) : []),
    [activeStory, storyFastMode],
  );
  const storyPageText = storyPages[storyPage] ?? storyPages[0] ?? "";
  const commentTrayStoryPlaying = showChips && !customCommentHasText && commentStories.length > 0;
  const storyPlayerActive = storyOpen || commentTrayStoryPlaying;

  function openCommentStories(): void {
    if (commentStories.length === 0) return;
    setStoryOpen(true);
    setStoryPage(0);
    setStoryFastMode(false);
    setStoryPlayKey((key) => key + 1);
  }

  function closeCommentStories(
    setIsPaused: (v: boolean) => void,
    setPageRevealed: (v: boolean) => void,
  ): void {
    setStoryOpen(false);
    setIsPaused(false);
    setPageRevealed(false);
  }

  function skipCommentStory(direction: 1 | -1): void {
    if (commentStories.length === 0) return;
    setStoryIndex((index) => (index + direction + commentStories.length) % commentStories.length);
    setStoryPage(0);
    setStoryPlayKey((key) => key + 1);
  }

  function handleStoryDrag(
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ): void {
    if (info.offset.x < -48 || info.velocity.x < -520) {
      skipCommentStory(1);
      return;
    }
    if (info.offset.x > 48 || info.velocity.x > 520) {
      skipCommentStory(-1);
    }
  }

  return {
    commentStories,
    storyOpen,
    setStoryOpen,
    storyIndex,
    setStoryIndex,
    storyPage,
    setStoryPage,
    storyPlayKey,
    setStoryPlayKey,
    storyFastMode,
    setStoryFastMode,
    activeStory,
    storyPages,
    storyPageText,
    commentTrayStoryPlaying,
    storyPlayerActive,
    openCommentStories,
    closeCommentStories,
    skipCommentStory,
    handleStoryDrag,
  };
}
