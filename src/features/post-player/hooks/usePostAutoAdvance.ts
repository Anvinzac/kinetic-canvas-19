/**
 * Auto-advance timers for floating comments, draft pages, and comment stories.
 *
 * Exports: usePostAutoAdvance
 * Depends on: comment-text flight/story duration helpers
 */

import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import {
  getCommentFlightDuration,
  getCommentLabel,
  getFastStoryDuration,
  getFloatingCommentLabel,
  getStoryPageDuration,
} from "../lib/comment-text";
import type { Comment, CommentStory, FlowComment } from "../types";

export type UsePostAutoAdvanceArgs = {
  isExporting: boolean;
  isPaused: boolean;
  isVisible: boolean;
  storyOpen: boolean;
  commentFlowKey: string;
  floatingComments: Comment[];
  setActiveComment: Dispatch<SetStateAction<FlowComment | null>>;
  manualCommentHoldUntil: MutableRefObject<number>;
  storyPlayerActive: boolean;
  storyFastMode: boolean;
  storyIndex: number;
  setStoryPage: Dispatch<SetStateAction<number>>;
  setStoryPlayKey: Dispatch<SetStateAction<number>>;
  setStoryIndex: Dispatch<SetStateAction<number>>;
  normalizedCustomComment: string;
  setDraftCommentPage: Dispatch<SetStateAction<number>>;
  setDraftCommentPlayKey: Dispatch<SetStateAction<number>>;
  showChips: boolean;
  customCommentHasText: boolean;
  draftCommentPages: string[];
  draftCommentPageText: string;
  draftCommentPlayKey: number;
  activeStory: CommentStory | null;
  storyPages: string[];
  commentStoriesLength: number;
  storyPage: number;
  storyPageText: string;
};

/**
 * @responsibility Effects 9–13: float cycle, story/draft page resets and advances.
 */
export function usePostAutoAdvance({
  isExporting,
  isPaused,
  isVisible,
  storyOpen,
  commentFlowKey,
  floatingComments,
  setActiveComment,
  manualCommentHoldUntil,
  storyPlayerActive,
  storyFastMode,
  storyIndex,
  setStoryPage,
  setStoryPlayKey,
  setStoryIndex,
  normalizedCustomComment,
  setDraftCommentPage,
  setDraftCommentPlayKey,
  showChips,
  customCommentHasText,
  draftCommentPages,
  draftCommentPageText,
  draftCommentPlayKey,
  activeStory,
  storyPages,
  commentStoriesLength,
  storyPage,
  storyPageText,
}: UsePostAutoAdvanceArgs): void {
  // Effect 9: cycle floating comments.
  useEffect(() => {
    if (isExporting || isPaused || !isVisible || storyOpen) {
      setActiveComment(null);
      return;
    }
    if (floatingComments.length === 0) {
      setActiveComment(null);
      return;
    }

    let index = 0;
    let cancelled = false;
    let timer: number | undefined;

    const showNext = () => {
      if (cancelled) return;
      const remainingManualHold = manualCommentHoldUntil.current - Date.now();
      if (remainingManualHold > 0) {
        timer = window.setTimeout(showNext, remainingManualHold);
        return;
      }

      const comment = floatingComments[index % floatingComments.length];
      const label = getFloatingCommentLabel(getCommentLabel(comment.chip_id));
      setActiveComment({
        key: `${comment.id}-${index}`,
        chip: comment.chip_id,
        created_at: comment.created_at,
        user_id: comment.user_id,
      });
      index += 1;
      timer = window.setTimeout(showNext, getCommentFlightDuration(label) + 700);
    };

    showNext();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [commentFlowKey, floatingComments, isExporting, isPaused, isVisible, storyOpen]);

  // Effect 10: reset story page when the active story/player changes.
  useEffect(() => {
    if (!storyPlayerActive) return;
    setStoryPage(0);
    setStoryPlayKey((key) => key + 1);
  }, [storyFastMode, storyIndex, storyPlayerActive]);

  // Effect 11: reset draft pages when custom comment text changes.
  useEffect(() => {
    setDraftCommentPage(0);
    setDraftCommentPlayKey((key) => key + 1);
  }, [normalizedCustomComment]);

  // Effect 12: advance draft comment pages.
  useEffect(() => {
    if (!showChips || !customCommentHasText || draftCommentPages.length === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setDraftCommentPage((page) => {
        if (draftCommentPages.length <= 1) return 0;
        return (page + 1) % draftCommentPages.length;
      });
      setDraftCommentPlayKey((key) => key + 1);
    }, getStoryPageDuration(draftCommentPageText));

    return () => window.clearTimeout(timer);
  }, [
    customCommentHasText,
    draftCommentPageText,
    draftCommentPages.length,
    showChips,
    draftCommentPlayKey,
  ]);

  // Effect 13: advance kinetic comment stories.
  useEffect(() => {
    if (
      !storyPlayerActive ||
      !activeStory ||
      storyPages.length === 0 ||
      commentStoriesLength === 0
    ) {
      return;
    }

    const duration = storyFastMode
      ? getFastStoryDuration(activeStory.text): getStoryPageDuration(storyPageText);

    const timer = window.setTimeout(() => {
      if (!storyFastMode && storyPage < storyPages.length - 1) {
        setStoryPage((page) => page + 1);
        setStoryPlayKey((key) => key + 1);
        return;
      }

      setStoryIndex((index) => (index + 1) % commentStoriesLength);
      setStoryPage(0);
      setStoryPlayKey((key) => key + 1);
    }, duration);

    return () => window.clearTimeout(timer);
  }, [
    activeStory,
    commentStoriesLength,
    storyFastMode,
    storyPlayerActive,
    storyPage,
    storyPageText,
    storyPages.length,
  ]);
}
