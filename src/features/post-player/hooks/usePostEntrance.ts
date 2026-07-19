/**
 * Flying-comment info-dim clear (Effect 1) and canvas tap / reveal handlers.
 *
 * Exports: usePostEntrance
 * Depends on: react useEffect
 */

import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { FlowComment } from "../types";

export type UsePostEntranceArgs = {
  showingFlyingComment: boolean;
  setCommentOverlapsInfo: Dispatch<SetStateAction<boolean>>;
  isExporting: boolean;
  isPaused: boolean;
  pageRevealed: boolean;
  setIsPaused: Dispatch<SetStateAction<boolean>>;
  setPageRevealed: Dispatch<SetStateAction<boolean>>;
  setPlayKey: Dispatch<SetStateAction<number>>;
  setActiveComment: Dispatch<SetStateAction<FlowComment | null>>;
  setShowChips: Dispatch<SetStateAction<boolean>>;
  setActionMenuOpen: Dispatch<SetStateAction<boolean>>;
  showNextTextPage: (revealed: boolean) => void;
  setTextPage: Dispatch<SetStateAction<number>>;
  setBackgroundShiftPage: Dispatch<SetStateAction<number>>;
  setSlide: Dispatch<SetStateAction<number>>;
};

export type UsePostEntranceResult = {
  handleCanvasTap: () => void;
  resetCurrentPage: () => void;
  replayFromBeginning: () => void;
};

/**
 * @responsibility Effect 1 (dim clear) plus tap-to-reveal / replay entrance UX.
 */
export function usePostEntrance({
  showingFlyingComment,
  setCommentOverlapsInfo,
  isExporting,
  isPaused,
  pageRevealed,
  setIsPaused,
  setPageRevealed,
  setPlayKey,
  setActiveComment,
  setShowChips,
  setActionMenuOpen,
  showNextTextPage,
  setTextPage,
  setBackgroundShiftPage,
  setSlide,
}: UsePostEntranceArgs): UsePostEntranceResult {
  // Effect 1 (original order): clear info dim when no chip is flying.
  useEffect(() => {
    if (!showingFlyingComment) setCommentOverlapsInfo(false);
  }, [showingFlyingComment, setCommentOverlapsInfo]);

  function handleCanvasTap(): void {
    if (isExporting) return;
    setShowChips(false);
    setActionMenuOpen(false);
    setActiveComment(null);

    if (isPaused) {
      setIsPaused(false);
      setPageRevealed(false);
      setPlayKey((key) => key + 1);
      return;
    }

    if (!pageRevealed) {
      setPageRevealed(true);
      return;
    }

    showNextTextPage(true);
  }

  function resetCurrentPage(): void {
    setIsPaused(false);
    setPageRevealed(false);
    setPlayKey((key) => key + 1);
    setActiveComment(null);
  }

  function replayFromBeginning(): void {
    setIsPaused(false);
    setTextPage(0);
    setBackgroundShiftPage(0);
    setSlide(0);
    setPageRevealed(false);
    setPlayKey((key) => key + 1);
    setActiveComment(null);
  }

  return { handleCanvasTap, resetCurrentPage, replayFromBeginning };
}
