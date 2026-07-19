/**
 * Post identity reset, observers, and tempo-driven text page advances.
 *
 * Exports: usePostPageTiming
 * Depends on: playback-timing getPageDuration, comment-text normalizeComment
 */

import {
  useEffect,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import type { CanvasSpec } from "@/lib/canvas";
import { normalizeComment } from "../lib/comment-text";
import { getPageDuration } from "../lib/playback-timing";
import type { Comment, Post } from "../types";

export type UsePostPageTimingArgs = {
  post: Post;
  spec: CanvasSpec;
  textPages: string[];
  media: string[];
  currentText: string;
  textPage: number;
  setTextPage: Dispatch<SetStateAction<number>>;
  setBackgroundShiftPage: Dispatch<SetStateAction<number>>;
  setSlide: Dispatch<SetStateAction<number>>;
  setPlayKey: Dispatch<SetStateAction<number>>;
  isPaused: boolean;
  setIsPaused: Dispatch<SetStateAction<boolean>>;
  isVisible: boolean;
  setIsVisible: Dispatch<SetStateAction<boolean>>;
  pageRevealed: boolean;
  setPageRevealed: Dispatch<SetStateAction<boolean>>;
  isExporting: boolean;
  setIsExporting: Dispatch<SetStateAction<boolean>>;
  setActionMenuOpen: Dispatch<SetStateAction<boolean>>;
  canvasEl: HTMLElement | null;
  canvasRef: RefObject<HTMLElement | null>;
  setCanvasWidth: Dispatch<SetStateAction<number>>;
  comments: Comment[];
  setLocalComments: Dispatch<SetStateAction<Comment[]>>;
  setStoryOpen: Dispatch<SetStateAction<boolean>>;
  setStoryIndex: Dispatch<SetStateAction<number>>;
  setStoryPage: Dispatch<SetStateAction<number>>;
  setStoryFastMode: Dispatch<SetStateAction<boolean>>;
  commentStoriesLength: number;
  resetCollectionPicker: () => void;
};

/**
 * Effects 3–8: reset, locals, story range, observers, page timer.
 * @param args - Playback clocks, canvas observers, and story/comment setters
 * @returns void (registers effects only)
 */
export function usePostPageTiming({
  post,
  spec,
  textPages,
  media,
  currentText,
  textPage,
  setTextPage,
  setBackgroundShiftPage,
  setSlide,
  setPlayKey,
  isPaused,
  setIsPaused,
  isVisible,
  setIsVisible,
  pageRevealed,
  setPageRevealed,
  isExporting,
  setIsExporting,
  setActionMenuOpen,
  canvasEl,
  canvasRef,
  setCanvasWidth,
  comments,
  setLocalComments,
  setStoryOpen,
  setStoryIndex,
  setStoryPage,
  setStoryFastMode,
  commentStoriesLength,
  resetCollectionPicker,
}: UsePostPageTimingArgs): void {
  // Effect 3: reset player when the post identity/text changes.
  useEffect(() => {
    setTextPage(0);
    setBackgroundShiftPage(0);
    setSlide(0);
    setPlayKey(0);
    setIsPaused(false);
    setIsVisible(false);
    setStoryOpen(false);
    setStoryIndex(0);
    setStoryPage(0);
    setStoryFastMode(false);
    setActionMenuOpen(false);
    setPageRevealed(false);
    setLocalComments([]);
    resetCollectionPicker();
    setIsExporting(false);
  }, [post.id, spec.text]);

  // Effect 4: drop optimistic locals once the server echo arrives.
  useEffect(() => {
    const serverCommentLabels = new Set(
      comments.map((comment) => normalizeComment(comment.chip_id)),
    );
    setLocalComments((items) => {
      if (items.length === 0) return items;
      const next = items.filter(
        (item) => !serverCommentLabels.has(normalizeComment(item.chip_id)),
      );
      return next.length === items.length ? items : next;
    });
  }, [comments]);

  // Effect 5: keep story index in range.
  useEffect(() => {
    if (commentStoriesLength === 0) {
      setStoryOpen(false);
      setStoryIndex(0);
      return;
    }
    setStoryIndex((index) => Math.min(index, commentStoriesLength - 1));
  }, [commentStoriesLength]);

  // Effect 6: visibility observer.
  useEffect(() => {
    if (!canvasEl) return;
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), {
      threshold: 0.4,
    });
    observer.observe(canvasEl);
    return () => observer.disconnect();
  }, [canvasEl]);

  // Effect 7: canvas width observer.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateCanvasWidth = () => {
      setCanvasWidth(canvas.getBoundingClientRect().width || 390);
    };

    updateCanvasWidth();
    const observer = new ResizeObserver(updateCanvasWidth);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // Effect 8: advance text pages on a tempo timer.
  useEffect(() => {
    if (isPaused || !isVisible) return;
    if (pageRevealed) return;
    if (textPages.length < 2) return;
    if (isExporting && textPage >= textPages.length - 1) return;
    const timer = window.setTimeout(
      () => {
        const nextPage = isExporting
          ? Math.min(textPage + 1, textPages.length - 1): (textPage + 1) % textPages.length;
        setTextPage(nextPage);
        setBackgroundShiftPage((page) => page + 1);
        setPageRevealed(false);
        if (post.post_type === "slideshow" && media.length > 1) {
          setSlide(nextPage % media.length);
        }
        setPlayKey((key) => key + 1);
      },
      getPageDuration(currentText, spec.tempo, spec.rhythm),
    );
    return () => window.clearTimeout(timer);
  }, [
    currentText,
    isExporting,
    isPaused,
    isVisible,
    media.length,
    pageRevealed,
    post.id,
    post.post_type,
    spec.rhythm,
    spec.tempo,
    textPage,
    textPages.length,
  ]);
}
