/**
 * PostCard playback runtime: pages, visibility, pause, canvas size, and effect orchestration.
 *
 * Exports: usePostPlayback
 * Depends on: useCommentFlow, useCommentStory, useTextFitScale, usePostExport, post-player lib
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";
import {
  getPostPhotoUrl,
  hasPostPhotoBackdrop,
} from "@/lib/post-media";
import { parseCanvas, type CanvasSpec } from "@/lib/canvas";
import { getCanvasPatternTheme } from "@/lib/canvas-patterns";
import { getCanvasSceneTheme } from "@/lib/canvas-scenes";
import { paginateText } from "../lib/paginate";
import {
  CHIP_EXIT_PAD,
  getCommentFlightDuration,
  getCommentLabel,
  getFastStoryDuration,
  getFloatingCommentLabel,
  getStoryPageDuration,
  normalizeComment,
  shouldFloatComment,
} from "../lib/comment-text";
import { getPageDuration, getUniformPageTextSize } from "../lib/playback-timing";
import {
  getResolvedPostBackground,
  getSlidingCanvasBackground,
} from "../lib/post-background";
import {
  getArticlePreview,
  getPostHashtags,
  getPostShareUrl,
  getPostViewCount,
} from "../lib/post-meta";
import type { PostCardProps } from "../types";
import { useCommentFlow } from "./useCommentFlow";
import { useCommentStory } from "./useCommentStory";
import { usePostExport } from "./usePostExport";
import { useTextFitScale } from "./useTextFitScale";

/**
 * @responsibility Own PostCard runtime state and preserve original effect ordering.
 */
export function usePostPlayback({
  post,
  author,
  likes,
  comments,
  liked,
  profilesById,
  currentUserId,
  onLike,
  onComment,
}: PostCardProps) {
  const spec = parseCanvas(post.canvas_html);
  const textPages = useMemo(() => paginateText(spec.text), [spec.text]);

  const storyIndexApiRef = useRef<{
    setStoryIndex: Dispatch<SetStateAction<number>>;
    commentStoriesLength: number;
  } | null>(null);

  const [slide, setSlide] = useState(0);
  const [textPage, setTextPage] = useState(0);
  const [playKey, setPlayKey] = useState(0);
  const [backgroundShiftPage, setBackgroundShiftPage] = useState(0);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [pageRevealed, setPageRevealed] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(390);
  const [canvasEl, setCanvasEl] = useState<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const postUrl = getPostShareUrl(post.id);

  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressRef = useRef(false);

  const commentFlow = useCommentFlow({
    comments,
    postId: post.id,
    currentUserId,
    onComment,
    storyIndexApiRef,
  });

  const commentStory = useCommentStory({
    chronologicalComments: commentFlow.chronologicalComments,
    showChips: commentFlow.showChips,
    customCommentHasText: commentFlow.customCommentHasText,
  });

  storyIndexApiRef.current = {
    setStoryIndex: commentStory.setStoryIndex,
    commentStoriesLength: commentStory.commentStories.length,
  };

  function handleLikePointerDown(e: ReactPointerEvent): void {
    e.stopPropagation();
    didLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      commentFlow.setShowChips(false);
      setActionMenuOpen(false);
      commentFlow.setActiveComment(null);
      setShowCollectionPicker(true);
      setIsPaused(true);
    }, 520);
  }

  function handleLikePointerUp(e: ReactPointerEvent): void {
    e.stopPropagation();
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (!didLongPressRef.current) {
      onLike();
    }
  }

  function handleLikePointerCancel(): void {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function handleToggleFolder(id: string): void {
    setSelectedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleToggleTag(tag: string): void {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  function handleCollectionSave(): void {
    setShowCollectionPicker(false);
    setIsPaused(false);
  }

  function handleCollectionClose(): void {
    setShowCollectionPicker(false);
    setIsPaused(false);
  }

  const media = post.media_urls ?? [];
  const articlePreview = getArticlePreview(spec, media);
  const commentLaneWidth = Math.max(180, canvasWidth - 96);
  const commentMaxWidth = Math.min(commentLaneWidth * 0.78, 290);
  const commentTravelHalf = (canvasWidth + commentMaxWidth) / 2 + CHIP_EXIT_PAD;
  const commentStartX = commentTravelHalf;
  const commentEndX = -commentTravelHalf;
  const commentInfoRightEdge = -canvasWidth / 2 + 16 + Math.min(canvasWidth * 0.7, 260);
  const commentInfoLeftEdge = -canvasWidth / 2 + 16;
  const commentOverlapEnterX = commentInfoRightEdge + commentMaxWidth / 2;
  const commentOverlapExitX = commentInfoLeftEdge - commentMaxWidth / 2;
  const currentText = textPages[textPage] ?? textPages[0] ?? "";
  const sceneTheme = getCanvasSceneTheme(spec.backgroundScene);
  const patternTheme = getCanvasPatternTheme(spec.backgroundPattern);
  const photoUrl = post.post_type === "slideshow" ? null : getPostPhotoUrl(post);
  const hasPhotoBackdrop =
    hasPostPhotoBackdrop(post) ||
    (post.post_type === "video" && Boolean(media[0]) && !photoUrl);
  const resolvedPostBackground = getResolvedPostBackground(post);
  const staticCanvasBackground = sceneTheme
    ? sceneTheme.base
    : patternTheme
      ? patternTheme.base
      : resolvedPostBackground;
  const slidingCanvasBackground = useMemo(
    () =>
      sceneTheme || patternTheme
        ? null
        : getSlidingCanvasBackground(spec, staticCanvasBackground ?? null, backgroundShiftPage),
    [sceneTheme, patternTheme, backgroundShiftPage, spec, staticCanvasBackground],
  );
  const hasTransitionBackground = !!slidingCanvasBackground;

  const activeCommentAuthor = commentFlow.activeComment
    ? profilesById.get(commentFlow.activeComment.user_id)
    : undefined;
  const showingFlyingComment =
    !isExporting &&
    !isPaused &&
    !!commentFlow.activeComment &&
    shouldFloatComment(commentFlow.activeCommentLabel);

  // Effect 1 (original order): clear info dim when no chip is flying.
  useEffect(() => {
    if (!showingFlyingComment) commentFlow.setCommentOverlapsInfo(false);
  }, [showingFlyingComment, commentFlow.setCommentOverlapsInfo]);

  const postHashtags = useMemo(
    () => getPostHashtags(spec.text, post.post_type, textPages),
    [post.post_type, spec.text, textPages],
  );
  const viewCount = useMemo(
    () => getPostViewCount(post, likes, commentFlow.chronologicalComments.length),
    [commentFlow.chronologicalComments.length, likes, post],
  );
  const uniformPageSize = useMemo(
    () => getUniformPageTextSize(spec.size, textPages, spec.text),
    [spec.size, textPages, spec.text],
  );

  // Effect 2: shared page-fit reset lives inside useTextFitScale.
  const textFit = useTextFitScale({
    textPages,
    uniformPageSize,
    canvasWidth,
    currentText,
  });

  const displaySpec: CanvasSpec = {
    ...spec,
    text: currentText,
    size: textFit.displaySize,
    entrance: "fade",
  };

  // Effect 3: reset player when the post identity/text changes.
  useEffect(() => {
    setTextPage(0);
    setBackgroundShiftPage(0);
    setSlide(0);
    setPlayKey(0);
    setIsPaused(false);
    setIsVisible(false);
    commentStory.setStoryOpen(false);
    commentStory.setStoryIndex(0);
    commentStory.setStoryPage(0);
    commentStory.setStoryFastMode(false);
    setActionMenuOpen(false);
    setPageRevealed(false);
    commentFlow.setLocalComments([]);
    setShowCollectionPicker(false);
    setSelectedFolders(new Set());
    setSelectedTags(new Set());
    setIsExporting(false);
  }, [post.id, spec.text]);

  // Effect 4: drop optimistic locals once the server echo arrives.
  useEffect(() => {
    const serverCommentLabels = new Set(
      comments.map((comment) => normalizeComment(comment.chip_id)),
    );
    commentFlow.setLocalComments((items) => {
      if (items.length === 0) return items;
      const next = items.filter(
        (item) => !serverCommentLabels.has(normalizeComment(item.chip_id)),
      );
      return next.length === items.length ? items : next;
    });
  }, [comments]);

  // Effect 5: keep story index in range.
  useEffect(() => {
    if (commentStory.commentStories.length === 0) {
      commentStory.setStoryOpen(false);
      commentStory.setStoryIndex(0);
      return;
    }
    commentStory.setStoryIndex((index) =>
      Math.min(index, commentStory.commentStories.length - 1),
    );
  }, [commentStory.commentStories.length]);

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
          ? Math.min(textPage + 1, textPages.length - 1)
          : (textPage + 1) % textPages.length;
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

  // Effect 9: cycle floating comments.
  useEffect(() => {
    if (isExporting || isPaused || !isVisible || commentStory.storyOpen) {
      commentFlow.setActiveComment(null);
      return;
    }
    if (commentFlow.floatingComments.length === 0) {
      commentFlow.setActiveComment(null);
      return;
    }

    let index = 0;
    let cancelled = false;
    let timer: number | undefined;

    const showNext = () => {
      if (cancelled) return;
      const remainingManualHold = commentFlow.manualCommentHoldUntil.current - Date.now();
      if (remainingManualHold > 0) {
        timer = window.setTimeout(showNext, remainingManualHold);
        return;
      }

      const comment = commentFlow.floatingComments[index % commentFlow.floatingComments.length];
      const label = getFloatingCommentLabel(getCommentLabel(comment.chip_id));
      commentFlow.setActiveComment({
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
  }, [
    commentFlow.commentFlowKey,
    commentFlow.floatingComments,
    isExporting,
    isPaused,
    isVisible,
    commentStory.storyOpen,
  ]);

  // Effect 10: reset story page when the active story/player changes.
  useEffect(() => {
    if (!commentStory.storyPlayerActive) return;
    commentStory.setStoryPage(0);
    commentStory.setStoryPlayKey((key) => key + 1);
  }, [commentStory.storyFastMode, commentStory.storyIndex, commentStory.storyPlayerActive]);

  // Effect 11: reset draft pages when custom comment text changes.
  useEffect(() => {
    commentFlow.setDraftCommentPage(0);
    commentFlow.setDraftCommentPlayKey((key) => key + 1);
  }, [commentFlow.normalizedCustomComment]);

  // Effect 12: advance draft comment pages.
  useEffect(() => {
    if (
      !commentFlow.showChips ||
      !commentFlow.customCommentHasText ||
      commentFlow.draftCommentPages.length === 0
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      commentFlow.setDraftCommentPage((page) => {
        if (commentFlow.draftCommentPages.length <= 1) return 0;
        return (page + 1) % commentFlow.draftCommentPages.length;
      });
      commentFlow.setDraftCommentPlayKey((key) => key + 1);
    }, getStoryPageDuration(commentFlow.draftCommentPageText));

    return () => window.clearTimeout(timer);
  }, [
    commentFlow.customCommentHasText,
    commentFlow.draftCommentPageText,
    commentFlow.draftCommentPages.length,
    commentFlow.showChips,
    commentFlow.draftCommentPlayKey,
  ]);

  // Effect 13: advance kinetic comment stories.
  useEffect(() => {
    if (
      !commentStory.storyPlayerActive ||
      !commentStory.activeStory ||
      commentStory.storyPages.length === 0 ||
      commentStory.commentStories.length === 0
    ) {
      return;
    }

    const duration = commentStory.storyFastMode
      ? getFastStoryDuration(commentStory.activeStory.text)
      : getStoryPageDuration(commentStory.storyPageText);

    const timer = window.setTimeout(() => {
      if (!commentStory.storyFastMode && commentStory.storyPage < commentStory.storyPages.length - 1) {
        commentStory.setStoryPage((page) => page + 1);
        commentStory.setStoryPlayKey((key) => key + 1);
        return;
      }

      commentStory.setStoryIndex(
        (index) => (index + 1) % commentStory.commentStories.length,
      );
      commentStory.setStoryPage(0);
      commentStory.setStoryPlayKey((key) => key + 1);
    }, duration);

    return () => window.clearTimeout(timer);
  }, [
    commentStory.activeStory,
    commentStory.commentStories.length,
    commentStory.storyFastMode,
    commentStory.storyPlayerActive,
    commentStory.storyPage,
    commentStory.storyPageText,
    commentStory.storyPages.length,
  ]);

  // Effect 14: sync video element with pause/visibility.
  useEffect(() => {
    if (post.post_type !== "video") return;
    const video = videoRef.current;
    if (!video) return;
    if (isPaused || !isVisible) {
      video.pause();
      return;
    }
    video.play().catch(() => undefined);
  }, [isPaused, isVisible, post.post_type]);

  const { handleExportVideo } = usePostExport({
    post,
    textPages,
    tempo: spec.tempo,
    rhythm: spec.rhythm,
    isExporting,
    setIsExporting,
    setActionMenuOpen,
    setShowChips: commentFlow.setShowChips,
    setShowQuickCommentChips: commentFlow.setShowQuickCommentChips,
    setShowCollectionPicker,
    setStoryOpen: commentStory.setStoryOpen,
    setActiveComment: commentFlow.setActiveComment,
    setCommentOverlapsInfo: commentFlow.setCommentOverlapsInfo,
    setIsPaused,
    setPageRevealed,
    setTextPage,
    setBackgroundShiftPage,
    setSlide,
    setPlayKey,
  });

  function showNextTextPage(revealed: boolean): void {
    if (textPages.length < 2) {
      setPageRevealed(revealed);
      setPlayKey((key) => key + 1);
      return;
    }

    const nextPage = (textPage + 1) % textPages.length;
    setTextPage(nextPage);
    setBackgroundShiftPage((page) => page + 1);
    setPageRevealed(revealed);
    if (post.post_type === "slideshow" && media.length > 1) {
      setSlide(nextPage % media.length);
    }
    setPlayKey((key) => key + 1);
  }

  function handleCanvasTap(): void {
    if (isExporting) return;
    commentFlow.setShowChips(false);
    setActionMenuOpen(false);
    commentFlow.setActiveComment(null);

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
    commentFlow.setActiveComment(null);
  }

  function replayFromBeginning(): void {
    setIsPaused(false);
    setTextPage(0);
    setBackgroundShiftPage(0);
    setSlide(0);
    setPageRevealed(false);
    setPlayKey((key) => key + 1);
    commentFlow.setActiveComment(null);
  }

  function selectTextPage(page: number): void {
    setIsPaused(false);
    setTextPage(page);
    setBackgroundShiftPage(page);
    setPageRevealed(false);
    if (post.post_type === "slideshow" && media.length > 1) {
      setSlide(page % media.length);
    }
    setPlayKey((key) => key + 1);
  }

  function toggleChips(): void {
    commentFlow.setShowChips((open) => {
      const next = !open;
      if (next) {
        commentStory.setStoryIndex(0);
        commentStory.setStoryPage(0);
        commentStory.setStoryFastMode(false);
        commentStory.setStoryPlayKey((key) => key + 1);
      } else {
        commentFlow.setShowQuickCommentChips(false);
      }
      return next;
    });
  }

  function openCommentStories(): void {
    commentStory.openCommentStories();
    commentFlow.setShowChips(false);
    commentFlow.setShowQuickCommentChips(false);
    setIsPaused(true);
  }

  return {
    post,
    author,
    likes,
    liked,
    comments,
    profilesById,
    spec,
    textPages,
    slide,
    textPage,
    playKey,
    backgroundShiftPage,
    actionMenuOpen,
    setActionMenuOpen,
    isPaused,
    isVisible,
    pageRevealed,
    isExporting,
    canvasWidth,
    canvasRef,
    setCanvasEl,
    videoRef,
    postUrl,
    showCollectionPicker,
    selectedFolders,
    selectedTags,
    media,
    articlePreview,
    commentMaxWidth,
    commentStartX,
    commentEndX,
    commentOverlapEnterX,
    commentOverlapExitX,
    currentText,
    sceneTheme,
    patternTheme,
    photoUrl,
    hasPhotoBackdrop,
    staticCanvasBackground,
    slidingCanvasBackground,
    hasTransitionBackground,
    displaySpec,
    postHashtags,
    viewCount,
    uniformPageSize,
    showingFlyingComment,
    activeCommentAuthor,
    textFit,
    commentFlow,
    commentStory,
    handleExportVideo,
    handleLikePointerDown,
    handleLikePointerUp,
    handleLikePointerCancel,
    handleToggleFolder,
    handleToggleTag,
    handleCollectionSave,
    handleCollectionClose,
    handleCanvasTap,
    resetCurrentPage,
    replayFromBeginning,
    selectTextPage,
    toggleChips,
    openCommentStories,
    closeCommentStories: () =>
      commentStory.closeCommentStories(setIsPaused, setPageRevealed),
  };
}

export type UsePostPlaybackResult = ReturnType<typeof usePostPlayback>;
