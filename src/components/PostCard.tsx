import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  motion,
  type PanInfo,
  type TargetAndTransition,
  type Transition,
} from "framer-motion";
import {
  ArrowUpRight,
  Bell,
  Download,
  FastForward,
  Heart,
  Home,
  Info,
  Link2,
  MessageCircle,
  MoreHorizontal,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Share2,
  User,
  X,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { CanvasStickerLayer } from "@/components/CanvasStickerLayer";
import { KenBurnsPhoto } from "@/components/KenBurnsPhoto";
import {
  getPostPhotoUrl,
  hasPostPhotoBackdrop,
  isAnimatedPhotoUrl,
  isPhotoMediaUrl,
} from "@/lib/post-media";
import {
  COMMENT_CHIPS,
  DEFAULT_CANVAS,
  SAFE_CANVAS_BACKGROUND,
  getCanvasEmphasisColor,
  getCanvasEmphasisWordColor,
  getCanvasTextColor,
  getPhotoBackdropTextShadow,
  isTooDarkCanvasBackground,
  isUsableCanvasBackground,
  parseCanvas,
  resolveTextColorOnPhotoBackdrop,
  resolveCanvasBackground,
  type CanvasLinkPreview,
  type CanvasSpec,
  type Rhythm,
  type Tempo,
} from "@/lib/canvas";
import { getCanvasPatternTheme, getPatternBackgroundPosition } from "@/lib/canvas-patterns";
import { getCanvasSceneTheme, getSceneBackgroundStyle } from "@/lib/canvas-scenes";
import {
  getSpecialPoeticWordIndexes,
  getTextPageWordLimit,
  getVietnameseWordLines,
  isLikelyVietnameseText,
  expandEmphasisToBoundPhrases,
} from "@/lib/text-language";

type Profile = { id: string; username: string; display_name: string; avatar_url: string | null };
type Post = {
  id: string;
  author_id: string;
  post_type: string;
  canvas_html: string;
  media_urls: string[] | null;
  bg_gradient: string | null;
  created_at: string;
};
type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  chip_id: string;
  created_at: string;
};
type FlowComment = { key: string; chip: string; created_at: string; user_id: string };
type CommentStory = {
  id: string;
  text: string;
  created_at: string;
  index: number;
  user_id: string;
};

// Keep kinetic text clear of the canvas edge without stealing its scale.
const TEXT_SAFE_MAX_WIDTH = "min(92%, calc(100% - 2rem))";
const TEXT_SAFE_TOP_PX = 72;
const TEXT_SAFE_BOTTOM_PX = 132;
const MIN_TEXT_FIT_SCALE = 0.58;
const MIN_ENGLISH_TEXT_FIT_SCALE = 0.72;
// A single-word page (e.g. a one-word reveal) cannot wrap, so it is allowed to
// shrink this far to fit a long word fully on screen.
const SOLO_TEXT_MIN_FIT = 0.3;
const SOLO_REVEAL_MIN_FIT = 0.62;
// The reveal word is the punchline of a guessing post — it should dominate the
// canvas. Solved-for directly as a share of the real canvas width, so a short
// word ("Dawn") grows well past its nominal size and a long one ("Persistence")
// shrinks just enough to land on the same target, never leaving empty margins.
// Held a touch under the safe edge (a hard 85%) so the word keeps its hero size
// while still leaving margin for the emphasis pulse/entrance overshoot — i.e. it
// never spills off either side even mid-animation.
const SOLO_REVEAL_TARGET_WIDTH_FRACTION = 0.85;
// Horizontal-only correction (transform: scaleX) closing any gap between the
// chosen font scale and the target width, without touching letter height.
const SOLO_REVEAL_MIN_INLINE_SCALE = 0.45;
const SOLO_REVEAL_MAX_STRETCH = 1.7;
const EMPHASIS_SCALE_FIT_GUARD = 1.14;
// Emphasized words render this many times larger than the base font. Applied via
// fontSize (not transform: scale) so the extra width occupies real layout space.
const EMPHASIS_FONT_SCALE = 1.12;
const EMPHASIS_VARIANTS = [
  "color",
  "sweep",
  "glow",
  "underline",
  "jiggle",
  "pulse",
  "halo",
  "frame",
] as const;
// glow and halo are luminous auras — they only read well on bright colors. On a
// dim/dark emphasis color they turn into an ugly muddy blob, so those colors get
// the non-luminous set only. sweep is a recolor + gliding shine, so it reads on
// any color.
const NON_LUMINOUS_EMPHASIS_VARIANTS = [
  "color",
  "sweep",
  "underline",
  "jiggle",
  "pulse",
  "frame",
] as const;
const VIETNAMESE_SCALE_FIT_GUARD = 1.06;
const DEFAULT_CANVAS_BACKGROUND = SAFE_CANVAS_BACKGROUND;
const ARC_BUTTON_TAP = { scale: 0.94, y: 2 };
const ARC_BUTTON_TAP_TRANSITION = { type: "spring" as const, stiffness: 400, damping: 24 };
// Show the comment action as the small hub inside the corner dock.
const SHOW_CORNER_COMMENT_ACTION = true;
// A compact cropped corner dock. The comment hub owns the inner half of the
// radius; the three subtle action cells sit on the outer half.
const RING_HUB = 24;
const RING_OUTER = 94;
const RING_HUB_RADIUS = 47;
const RING_RADIUS = 70;
const RING_DIVIDER_INSET = RING_HUB_RADIUS;
const RING_BTN_HALF = 20; // half of size-10 (40px) action buttons
const RING_BUTTON_ANGLES = [4, 45, 86];
const RING_DIVIDER_ANGLES = [23.5, 66.5];
function ringButtonOffset(angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  return {
    right: Math.round(RING_HUB + RING_RADIUS * Math.sin(a) - RING_BTN_HALF),
    bottom: Math.round(RING_HUB + RING_RADIUS * Math.cos(a) - RING_BTN_HALF),
  };
}
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const FLOATING_COMMENT_MAX_WORDS = 3;
// Extra px a flying comment chip travels past each screen edge so it glides fully
// out of view before being hidden, instead of stopping at the edge (abrupt pop).
const CHIP_EXIT_PAD = 56;
const MAX_COMMENT_WORDS = 36;
const MAX_COMMENT_CHARS = 240;
const COMMENT_STORY_WORDS_PER_PAGE = 8;

const tempoConfig: Record<
  Tempo,
  { pageMultiplier: number; wordDelay: number; wordDuration: number; loopSeconds: number }
> = {
  slow: { pageMultiplier: 1.22, wordDelay: 0.25, wordDuration: 0.72, loopSeconds: 3.4 },
  steady: { pageMultiplier: 1, wordDelay: 0.18, wordDuration: 0.5, loopSeconds: 2.4 },
  snappy: { pageMultiplier: 0.78, wordDelay: 0.1, wordDuration: 0.36, loopSeconds: 1.45 },
};

export function PostCard({
  post,
  author,
  likes,
  comments,
  liked,
  profilesById,
  currentUserId,
  onLike,
  onComment,
}: {
  post: Post;
  author?: Profile;
  profilesById: Map<string, Profile>;
  currentUserId: string | null;
  likes: number;
  comments: Comment[];
  liked: boolean;
  onLike: () => void;
  onComment: (chip: string) => void;
}) {
  const spec = parseCanvas(post.canvas_html);
  const textPages = useMemo(() => paginateText(spec.text), [spec.text]);
  const [localComments, setLocalComments] = useState<Comment[]>([]);
  const chronologicalComments = useMemo(
    () =>
      [...comments, ...localComments].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      ),
    [comments, localComments],
  );
  const floatingComments = useMemo(
    () =>
      chronologicalComments.filter((comment) =>
        shouldFloatComment(getCommentLabel(comment.chip_id)),
      ),
    [chronologicalComments],
  );
  const commentFlowKey = floatingComments
    .map((comment) => `${comment.id}:${comment.created_at}:${comment.chip_id}`)
    .join("|");
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

  const [slide, setSlide] = useState(0);
  const [textPage, setTextPage] = useState(0);
  const [playKey, setPlayKey] = useState(0);
  const [backgroundShiftPage, setBackgroundShiftPage] = useState(0);
  const [showChips, setShowChips] = useState(false);
  const [showQuickCommentChips, setShowQuickCommentChips] = useState(false);
  const [customComment, setCustomComment] = useState("");
  const [draftCommentPage, setDraftCommentPage] = useState(0);
  const [draftCommentPlayKey, setDraftCommentPlayKey] = useState(0);
  const [activeComment, setActiveComment] = useState<FlowComment | null>(null);
  // True only while a flying chip is actually passing over the bottom-left info
  // block — drives the brief translucency. The info is opaque the rest of the time.
  const [commentOverlapsInfo, setCommentOverlapsInfo] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);
  const [storyIndex, setStoryIndex] = useState(0);
  const [storyPage, setStoryPage] = useState(0);
  const [storyPlayKey, setStoryPlayKey] = useState(0);
  const [storyFastMode, setStoryFastMode] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [pageRevealed, setPageRevealed] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(390);
  const [canvasEl, setCanvasEl] = useState<HTMLElement | null>(null);
  const flyId = useRef(0);
  const localCommentId = useRef(0);
  const manualCommentHoldUntil = useRef(0);
  const canvasRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const postUrl = getPostShareUrl(post.id);

  // Collection picker (long-press on heart)
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressRef = useRef(false);

  function handleLikePointerDown(e: ReactPointerEvent) {
    e.stopPropagation();
    didLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      setShowChips(false);
      setActionMenuOpen(false);
      setActiveComment(null);
      setShowCollectionPicker(true);
      setIsPaused(true);
    }, 520);
  }

  function handleLikePointerUp(e: ReactPointerEvent) {
    e.stopPropagation();
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (!didLongPressRef.current) {
      onLike();
    }
  }

  function handleLikePointerCancel() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function handleToggleFolder(id: string) {
    setSelectedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleToggleTag(tag: string) {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  function handleCollectionSave() {
    // TODO: persist selection to backend
    setShowCollectionPicker(false);
    setIsPaused(false);
  }

  function handleCollectionClose() {
    setShowCollectionPicker(false);
    setIsPaused(false);
  }

  const media = post.media_urls ?? [];
  const articlePreview = getArticlePreview(spec, media);
  const commentLaneWidth = Math.max(180, canvasWidth - 96);
  const commentMaxWidth = Math.min(commentLaneWidth * 0.78, 290);
  // Flight path uses the lane's max chip width (a stable upper bound) rather than
  // the post-render measured width, so the path is fixed before the first frame and
  // never re-targets mid-flight. CHIP_EXIT_PAD adds extra travel past each screen
  // edge so the chip glides fully out before it is hidden — no abrupt pop.
  const commentTravelHalf = (canvasWidth + commentMaxWidth) / 2 + CHIP_EXIT_PAD;
  // Start: chip fully outside the right edge.
  const commentStartX = commentTravelHalf;
  // End: chip's right edge clears the left edge with CHIP_EXIT_PAD to spare.
  const commentEndX = -commentTravelHalf;
  // Horizontal band (in the chip's centered translate space) where a flying chip
  // overlaps the bottom-left info block. The info hugs the left edge (left-4) and
  // spans up to its max width; we use that upper bound so the dim leads the
  // overlap slightly and the two never visibly collide. Outside this band the
  // info stays fully opaque.
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
  // Scene/pattern posts ignore the gradient backdrop entirely; each theme's
  // solid base is what sits under the artwork and what the contrast picker reads.
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
  const activeStory = commentStories[storyIndex] ?? null;
  const storyPages = useMemo(
    () => (activeStory ? getCommentStoryPages(activeStory.text, storyFastMode) : []),
    [activeStory, storyFastMode],
  );
  const storyPageText = storyPages[storyPage] ?? storyPages[0] ?? "";
  const normalizedCustomComment = normalizeComment(customComment);
  const customCommentHasText = normalizedCustomComment.length > 0;
  const customCommentIsKinetic =
    customCommentHasText && !shouldFloatComment(normalizedCustomComment);
  const commentTrayStoryPlaying = showChips && !customCommentHasText && commentStories.length > 0;
  const storyPlayerActive = storyOpen || commentTrayStoryPlaying;
  const draftCommentPages = useMemo(
    () => (customCommentHasText ? getCommentStoryPages(normalizedCustomComment, false) : []),
    [customCommentHasText, normalizedCustomComment],
  );
  const draftCommentPageText = draftCommentPages[draftCommentPage] ?? draftCommentPages[0] ?? "";
  const draftCommentBackground = useMemo(
    () => getCommentStoryGradient(getStableNumber(normalizedCustomComment || "draft") % 8),
    [normalizedCustomComment],
  );
  const activeCommentLabel = activeComment ? getCommentLabel(activeComment.chip) : "";
  const activeCommentAuthor = activeComment ? profilesById.get(activeComment.user_id) : undefined;
  const showingFlyingComment =
    !isExporting && !isPaused && !!activeComment && shouldFloatComment(activeCommentLabel);

  // When no chip is in flight (gaps between comments, paused, scrolled away), the
  // info must return to fully opaque — the overlap flag only goes true while a
  // chip is actively crossing the block.
  useEffect(() => {
    if (!showingFlyingComment) setCommentOverlapsInfo(false);
  }, [showingFlyingComment]);
  const postHashtags = useMemo(
    () => getPostHashtags(spec.text, post.post_type, textPages),
    [post.post_type, spec.text, textPages],
  );
  const viewCount = useMemo(
    () => getPostViewCount(post, likes, chronologicalComments.length),
    [chronologicalComments.length, likes, post],
  );
  // Calculate uniform font size for all pages — size based on the SMALLEST
  // page (fewest words) so all pages can display large. Never shrinks below
  // minimum threshold.
  const uniformPageSize = useMemo(
    () => getUniformPageTextSize(spec.size, textPages, spec.text),
    [spec.size, textPages, spec.text],
  );

  // Every page can require a different shrink to fit (longer/wider lines shrink
  // more), which made some pages render noticeably smaller than others. To keep
  // a consistent immersive size, each page is measured off-screen and the single
  // SMALLEST fit that satisfies every page is applied uniformly to all of them.
  const [pageFitScales, setPageFitScales] = useState<Record<number, number>>({});
  const reportPageFit = useCallback((page: number, scale: number) => {
    setPageFitScales((prev) =>
      prev[page] !== undefined && Math.abs(prev[page] - scale) < 0.005
        ? prev
        : { ...prev, [page]: scale },
    );
  }, []);
  useEffect(() => {
    setPageFitScales({});
  }, [textPages, uniformPageSize, canvasWidth]);
  // Solo (single-word) pages are excluded from the shared sizing: they fit on
  // their own so a long reveal word can shrink to the screen without dragging
  // every other page down to match it.
  const sharedFitIndexes = useMemo(
    () => textPages.map((_, i) => i).filter((i) => !isSoloTextPage(textPages[i])),
    [textPages],
  );
  const needsSharedFit = sharedFitIndexes.length > 1;
  const allPagesMeasured =
    needsSharedFit && sharedFitIndexes.every((i) => pageFitScales[i] !== undefined);
  const sharedFitScale = allPagesMeasured
    ? Math.min(...sharedFitIndexes.map((i) => pageFitScales[i]))
    : 1;
  const currentIsSolo = isSoloTextPage(currentText);
  const useSharedSize = allPagesMeasured && !currentIsSolo;
  const displaySize = Math.max(
    MIN_FONT_SIZE,
    useSharedSize ? uniformPageSize * sharedFitScale : uniformPageSize,
  );

  const displaySpec: CanvasSpec = {
    ...spec,
    text: currentText,
    size: displaySize,
    entrance: "fade",
  };

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
    setShowCollectionPicker(false);
    setSelectedFolders(new Set());
    setSelectedTags(new Set());
    setIsExporting(false);
  }, [post.id, spec.text]);

  useEffect(() => {
    const serverCommentLabels = new Set(
      comments.map((comment) => normalizeComment(comment.chip_id)),
    );
    setLocalComments((items) => {
      if (items.length === 0) return items;
      const next = items.filter((item) => !serverCommentLabels.has(normalizeComment(item.chip_id)));
      return next.length === items.length ? items : next;
    });
  }, [comments]);

  useEffect(() => {
    if (commentStories.length === 0) {
      setStoryOpen(false);
      setStoryIndex(0);
      return;
    }
    setStoryIndex((index) => Math.min(index, commentStories.length - 1));
  }, [commentStories.length]);

  useEffect(() => {
    if (!canvasEl) return;
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), {
      threshold: 0.4,
    });
    observer.observe(canvasEl);
    return () => observer.disconnect();
  }, [canvasEl]);

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

  useEffect(() => {
    if (isPaused || !isVisible) return;
    if (pageRevealed) return;
    if (textPages.length < 2) return;
    if (isExporting && textPage >= textPages.length - 1) return;
    const timer = window.setTimeout(
      () => {
        // Rule: slideshow media advances only with text pages, never mid-sentence.
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

  useEffect(() => {
    if (!storyPlayerActive) return;
    setStoryPage(0);
    setStoryPlayKey((key) => key + 1);
  }, [storyFastMode, storyIndex, storyPlayerActive]);

  useEffect(() => {
    setDraftCommentPage(0);
    setDraftCommentPlayKey((key) => key + 1);
  }, [normalizedCustomComment]);

  useEffect(() => {
    if (!showChips || !customCommentHasText || draftCommentPages.length === 0) return;

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

  useEffect(() => {
    if (
      !storyPlayerActive ||
      !activeStory ||
      storyPages.length === 0 ||
      commentStories.length === 0
    ) {
      return;
    }

    const duration = storyFastMode
      ? getFastStoryDuration(activeStory.text)
      : getStoryPageDuration(storyPageText);

    const timer = window.setTimeout(() => {
      if (!storyFastMode && storyPage < storyPages.length - 1) {
        setStoryPage((page) => page + 1);
        setStoryPlayKey((key) => key + 1);
        return;
      }

      setStoryIndex((index) => (index + 1) % commentStories.length);
      setStoryPage(0);
      setStoryPlayKey((key) => key + 1);
    }, duration);

    return () => window.clearTimeout(timer);
  }, [
    activeStory,
    commentStories.length,
    storyFastMode,
    storyPlayerActive,
    storyPage,
    storyPageText,
    storyPages.length,
  ]);

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

  async function handleExportVideo() {
    if (isExporting) return;
    if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === "undefined") {
      toast.error("video export is not supported in this browser");
      return;
    }

    const mimeType = getSupportedExportMimeType();
    if (mimeType === null) {
      toast.error("video export is not supported in this browser");
      return;
    }

    let stream: MediaStream | null = null;
    let recorder: MediaRecorder | null = null;
    const chunks: BlobPart[] = [];

    try {
      setActionMenuOpen(false);
      setShowChips(false);
      setShowQuickCommentChips(false);
      setShowCollectionPicker(false);
      setStoryOpen(false);
      setActiveComment(null);
      setCommentOverlapsInfo(false);
      toast.info("choose this tab when the recorder opens");
      await wait(250);
      toast.dismiss();

      setIsPaused(false);
      setPageRevealed(false);
      setTextPage(0);
      setBackgroundShiftPage(0);
      setSlide(0);
      setPlayKey((key) => key + 1);
      setIsExporting(true);
      await wait(450);

      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: 30,
          width: { ideal: 1080 },
          height: { ideal: 1920 },
        },
        audio: false,
      });

      if (mimeType && !mimeType.includes("mp4")) {
        toast.info("MP4 is not available here, exporting WebM instead");
      }

      const recorderOptions: MediaRecorderOptions = {
        videoBitsPerSecond: 8_000_000,
        ...(mimeType ? { mimeType } : {}),
      };
      recorder = new MediaRecorder(stream, recorderOptions);
      const recordingFinished = new Promise<void>((resolve, reject) => {
        if (!recorder) {
          reject(new Error("Recorder was not created"));
          return;
        }
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        recorder.onstop = () => resolve();
        recorder.onerror = () => reject(recorder?.error ?? new Error("Recording failed"));
      });

      recorder.start(250);
      await wait(getPostExportDuration(textPages, spec.tempo, spec.rhythm));
      if (recorder.state !== "inactive") recorder.stop();
      await recordingFinished;

      const blobType = mimeType || chunks[0]?.type || "video/webm";
      const blob = new Blob(chunks, { type: blobType });
      downloadBlob(blob, getPostExportFilename(post, blobType));
      toast.success(`exported ${getExportExtension(blobType).toUpperCase()} clip`);
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        toast.error("could not export this status");
      }
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
      setIsExporting(false);
    }
  }

  function showNextTextPage(revealed: boolean) {
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

  function handleCanvasTap() {
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

  function resetCurrentPage() {
    setIsPaused(false);
    setPageRevealed(false);
    setPlayKey((key) => key + 1);
    setActiveComment(null);
  }

  function replayFromBeginning() {
    setIsPaused(false);
    setTextPage(0);
    setBackgroundShiftPage(0);
    setSlide(0);
    setPageRevealed(false);
    setPlayKey((key) => key + 1);
    setActiveComment(null);
  }

  function openCommentStories() {
    if (commentStories.length === 0) return;
    setShowChips(false);
    setShowQuickCommentChips(false);
    setStoryOpen(true);
    setStoryPage(0);
    setStoryFastMode(false);
    setIsPaused(true);
    setStoryPlayKey((key) => key + 1);
  }

  function closeCommentStories() {
    setStoryOpen(false);
    setIsPaused(false);
    setPageRevealed(false);
  }

  function skipCommentStory(direction: 1 | -1) {
    if (commentStories.length === 0) return;
    setStoryIndex((index) => (index + direction + commentStories.length) % commentStories.length);
    setStoryPage(0);
    setStoryPlayKey((key) => key + 1);
  }

  function handleStoryDrag(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    if (info.offset.x < -48 || info.velocity.x < -520) {
      skipCommentStory(1);
      return;
    }
    if (info.offset.x > 48 || info.velocity.x > 520) {
      skipCommentStory(-1);
    }
  }

  function selectTextPage(page: number) {
    setIsPaused(false);
    setTextPage(page);
    setBackgroundShiftPage(page);
    setPageRevealed(false);
    if (post.post_type === "slideshow" && media.length > 1) {
      setSlide(page % media.length);
    }
    setPlayKey((key) => key + 1);
  }

  function previewSubmittedComment(chipId: string) {
    const label = getCommentLabel(chipId);
    if (!shouldFloatComment(label)) {
      localCommentId.current += 1;
      setStoryIndex(commentStories.length);
      setLocalComments((items) => [
        ...items,
        {
          id: `local-comment-${localCommentId.current}`,
          post_id: post.id,
          user_id: currentUserId ?? "local",
          chip_id: chipId,
          created_at: new Date().toISOString(),
        },
      ]);
      return;
    }

    flyId.current += 1;
    manualCommentHoldUntil.current =
      Date.now() + getCommentFlightDuration(getFloatingCommentLabel(getCommentLabel(chipId))) + 700;
    setActiveComment({
      key: `local-${flyId.current}`,
      chip: chipId,
      created_at: new Date().toISOString(),
      user_id: currentUserId ?? "local",
    });
  }

  function submitComment(value: string) {
    const normalized = normalizeComment(value);
    if (
      !normalized ||
      normalized.length > MAX_COMMENT_CHARS ||
      getWords(normalized).length > MAX_COMMENT_WORDS
    ) {
      return;
    }
    previewSubmittedComment(normalized);
    onComment(normalized);
    setCustomComment("");
    setShowChips(false);
    setShowQuickCommentChips(false);
    setDraftCommentPage(0);
    setDraftCommentPlayKey((key) => key + 1);
  }

  function updateCustomComment(value: string) {
    const limited = limitCommentText(value);
    const normalized = normalizeComment(limited);
    setCustomComment(limited);
    if (normalized && !shouldFloatComment(normalized)) {
      setShowQuickCommentChips(false);
    }
  }

  return (
    <section
      data-status-snap-item="true"
      className="relative flex h-[100dvh] w-full snap-start snap-always items-center justify-center overflow-hidden bg-background"
    >
      <article
        ref={(el) => {
          canvasRef.current = el;
          setCanvasEl(el);
        }}
        className="relative h-full w-full overflow-hidden bg-[url('/canvas-fallback.svg')] bg-cover bg-center sm:aspect-[9/16] sm:h-[min(90dvh,764px)] sm:w-auto sm:shadow-[0_24px_90px_rgba(0,0,0,0.45)] sm:ring-1 sm:ring-white/10"
        onClick={handleCanvasTap}
      >
        {sceneTheme ? (
          <div
            aria-hidden
            className="absolute inset-0"
            style={getSceneBackgroundStyle(sceneTheme, backgroundShiftPage)}
          />
        ) : patternTheme ? (
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              backgroundColor: patternTheme.base,
              backgroundImage: patternTheme.image,
              backgroundSize: patternTheme.size,
              backgroundRepeat: "repeat",
              // Drift the tiling pattern a fixed step per page turn. Because the
              // pattern repeats infinitely, any offset is seamless — there is no
              // edge to reach. CSS handles the slide so it needs no JS ticker.
              backgroundPosition: getPatternBackgroundPosition(patternTheme, backgroundShiftPage),
              transition: "background-position 1.25s cubic-bezier(0.22,1,0.36,1)",
            }}
          />
        ) : slidingCanvasBackground ? (
          <motion.div
            aria-hidden
            className="absolute inset-y-0 left-0"
            style={{
              background: DEFAULT_CANVAS_BACKGROUND,
              backgroundImage: slidingCanvasBackground.background,
              width: slidingCanvasBackground.width,
            }}
            initial={false}
            animate={{ x: slidingCanvasBackground.x }}
            transition={{ duration: 1.25, ease: [0.22, 1, 0.36, 1] }}
          />
        ) : (
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background: DEFAULT_CANVAS_BACKGROUND,
              backgroundImage: staticCanvasBackground,
            }}
          />
        )}
        {(hasTransitionBackground || patternTheme || sceneTheme) && (
          <motion.div
            key={`sheen-${post.id}-${backgroundShiftPage}`}
            aria-hidden
            className="absolute inset-0 opacity-40 mix-blend-screen"
            style={{
              background:
                "linear-gradient(115deg,rgba(255,255,255,0.22),transparent 42%,rgba(255,255,255,0.14))",
            }}
            initial={{ x: "-18%", opacity: 0 }}
            animate={{ x: "0%", opacity: 0.34 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
        {photoUrl && (
          <KenBurnsPhoto
            src={photoUrl}
            seed={post.id}
            paused={isPaused || isAnimatedPhotoUrl(photoUrl)}
            fallbackBackground={staticCanvasBackground}
          />
        )}
        {post.post_type === "video" && media[0] && !photoUrl && (
          <video
            ref={videoRef}
            src={media[0]}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 size-full object-cover"
          />
        )}
        {post.post_type === "slideshow" && media[slide] && isPhotoMediaUrl(media[slide]) && (
          <AnimatePresence mode="wait">
            <motion.div
              key={slide}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="absolute inset-0"
            >
              <KenBurnsPhoto
                src={media[slide]}
                seed={`${post.id}-${slide}`}
                paused={isPaused || isAnimatedPhotoUrl(media[slide])}
                fallbackBackground={staticCanvasBackground}
              />
            </motion.div>
          </AnimatePresence>
        )}

        {post.post_type !== "text" && hasPhotoBackdrop && (
          <>
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_32%,rgba(0,0,0,0.38)_100%)]"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-b from-black/38 via-black/22 to-black/68"
            />
          </>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={`${textPage}-${playKey}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: isVisible ? 1 : 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
            className="absolute inset-0"
          >
            {isVisible && (
              <WordSequenceText
                spec={displaySpec}
                playKey={playKey}
                paused={isPaused}
                revealed={pageRevealed}
                canvasWidth={canvasWidth}
                disableFit={useSharedSize}
                background={staticCanvasBackground}
                photoBackdrop={hasPhotoBackdrop}
                entranceSeed={spec.text}
              />
            )}
          </motion.div>
        </AnimatePresence>

        <CanvasStickerLayer
          stickers={spec.stickers}
          text={currentText}
          layout={displaySpec}
          playKey={`${textPage}-${playKey}`}
        />

        {isExporting && <ExportWatermark author={author} />}

        {/* Off-screen measurers: one per multi-word page at the uniform base size,
            so the smallest required fit can be shared across them (consistent
            size). Solo pages are skipped — they size themselves. */}
        {needsSharedFit && isVisible && (
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            {textPages.map((pageText, pageIndex) =>
              isSoloTextPage(pageText) ? null : (
                <WordSequenceText
                  key={`measure-${pageIndex}-${pageText.length}`}
                  spec={{ ...spec, text: pageText, size: uniformPageSize, entrance: "fade" }}
                  playKey={0}
                  paused
                  revealed
                  measure
                  canvasWidth={canvasWidth}
                  onFitScale={(scale) => reportPageFit(pageIndex, scale)}
                  background={staticCanvasBackground}
                  photoBackdrop={hasPhotoBackdrop}
                />
              ),
            )}
          </div>
        )}

        {!isExporting && textPages.length > 1 && (
          <div
            className="absolute bottom-24 left-1/2 z-20 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/25 px-2 py-1 backdrop-blur"
            onClick={(e) => e.stopPropagation()}
          >
            {textPages.map((_, page) => (
              <button
                key={page}
                type="button"
                onClick={() => selectTextPage(page)}
                className={`h-1.5 rounded-full transition ${
                  page === textPage ? "w-6 bg-white" : "w-1.5 bg-white/35"
                }`}
                aria-label={`Replay text page ${page + 1}`}
              />
            ))}
          </div>
        )}

        {!isExporting && author && (
          <Link
            to="/u/$username"
            params={{ username: author.username }}
            className="absolute left-4 top-4 z-20 flex h-10 items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={author.avatar_url ?? ""}
              alt=""
              className="size-10 rounded-full border-2 border-white/80"
            />
            <div className="leading-tight">
              <p className="text-sm font-bold text-white drop-shadow">@{author.username}</p>
              <p className="text-[10px] uppercase tracking-widest text-white/70 drop-shadow">
                {post.post_type}
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
            className="absolute right-3 top-4 z-30 grid size-10 place-items-center rounded-full bg-black/40 text-white shadow-[0_12px_30px_rgba(0,0,0,0.3)] ring-1 ring-white/15 backdrop-blur"
            aria-label="More choices"
            aria-expanded={actionMenuOpen}
          >
            <MoreHorizontal className="size-5" />
          </motion.button>
        )}

        <AnimatePresence>
          {!isExporting && actionMenuOpen && (
            <PostMenuRail key="menu" onExport={handleExportVideo} isExporting={isExporting} />
          )}
        </AnimatePresence>

        {!isExporting && (
          <motion.div
            key="actions"
            initial={{ opacity: 0, scale: 0.85, x: 18, y: 18 }}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-0 right-0 z-30 size-[148px]"
          >
            {/* Single cropped corner disc with three divided action zones. */}
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

            {/* Comment — inner half-radius hub tucked into the corner. */}
            {SHOW_CORNER_COMMENT_ACTION && (
              <motion.button
                type="button"
                whileTap={{ ...ARC_BUTTON_TAP, backgroundColor: "rgba(255,255,255,0.12)" }}
                transition={ARC_BUTTON_TAP_TRANSITION}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowChips((open) => {
                    const next = !open;
                    if (next) {
                      setStoryIndex(0);
                      setStoryPage(0);
                      setStoryFastMode(false);
                      setStoryPlayKey((key) => key + 1);
                    } else {
                      setShowQuickCommentChips(false);
                    }
                    return next;
                  });
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
                  {comments.length > 0 && (
                    <span
                      className="relative -mt-0.5 max-w-[1.8rem] truncate text-center font-mono text-[10px] font-black leading-none text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]"
                      style={{ fontSize: 10 }}
                    >
                      {formatCompactCount(comments.length)}
                    </span>
                  )}
                </span>
              </motion.button>
            )}

            {/* Create · Like · Share — on the outer ring */}
            {(() => {
              const ringActions: { key: string; el: ReactNode }[] = [
                {
                  key: "create",
                  el: (
                    <motion.div
                      whileTap={{ ...ARC_BUTTON_TAP, backgroundColor: "rgba(255,255,255,0.12)" }}
                      transition={ARC_BUTTON_TAP_TRANSITION}
                      className="grid size-10 place-items-center rounded-full text-white [filter:drop-shadow(0_1px_3px_rgba(0,0,0,0.7))]"
                    >
                      <Link
                        to="/create"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Create"
                        className="grid size-full place-items-center"
                      >
                        <Plus className="size-5" strokeWidth={2.5} />
                      </Link>
                    </motion.div>
                  ),
                },
                {
                  key: "like",
                  el: (
                    <motion.button
                      type="button"
                      whileTap={{ ...ARC_BUTTON_TAP, backgroundColor: "rgba(255,255,255,0.12)" }}
                      transition={ARC_BUTTON_TAP_TRANSITION}
                      onPointerDown={handleLikePointerDown}
                      onPointerUp={handleLikePointerUp}
                      onPointerCancel={handleLikePointerCancel}
                      onContextMenu={(e) => e.preventDefault()}
                      aria-label="Like (hold to save to collection)"
                      aria-pressed={liked}
                      className="grid size-10 touch-none place-items-center rounded-full [filter:drop-shadow(0_1px_3px_rgba(0,0,0,0.7))]"
                    >
                      <span className="relative grid size-7 place-items-center">
                        <Heart
                          className={`absolute inset-0 size-7 transition ${
                            liked
                              ? "scale-105 fill-[var(--color-magenta)] text-[var(--color-magenta)]"
                              : "fill-black/15 text-white/80"
                          }`}
                          strokeWidth={liked ? 1.2 : 0.9}
                        />
                        {likes > 0 && (
                          <span
                            className="relative mt-0.5 max-w-[1.8rem] truncate text-center font-mono text-[10px] font-black leading-none text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]"
                            style={{ fontSize: 10 }}
                          >
                            {formatCompactCount(likes)}
                          </span>
                        )}
                      </span>
                    </motion.button>
                  ),
                },
                {
                  key: "share",
                  el: (
                    <motion.button
                      type="button"
                      whileTap={{ ...ARC_BUTTON_TAP, backgroundColor: "rgba(255,255,255,0.12)" }}
                      transition={ARC_BUTTON_TAP_TRANSITION}
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          if (navigator.share) {
                            await navigator.share({
                              title: author
                                ? `${author.display_name} on Kinetic`
                                : "Kinetic status",
                              url: postUrl,
                            });
                          } else {
                            await navigator.clipboard.writeText(postUrl);
                            toast.success("post link copied");
                          }
                        } catch (error) {
                          if ((error as Error).name !== "AbortError")
                            toast.error("could not share post");
                        }
                      }}
                      aria-label="Share"
                      className="grid size-10 place-items-center rounded-full text-white [filter:drop-shadow(0_1px_3px_rgba(0,0,0,0.7))]"
                    >
                      <Share2 className="size-5" />
                    </motion.button>
                  ),
                },
              ];
              return ringActions.map((action, index) => {
                const { right, bottom } = ringButtonOffset(
                  RING_BUTTON_ANGLES[index] ?? RING_BUTTON_ANGLES[0],
                );
                return (
                  <div key={action.key} className="absolute" style={{ right, bottom }}>
                    {action.el}
                  </div>
                );
              });
            })()}
          </motion.div>
        )}

        <AnimatePresence>
          {!isExporting && showCollectionPicker && (
            <CollectionPicker
              selectedFolders={selectedFolders}
              selectedTags={selectedTags}
              onToggleFolder={handleToggleFolder}
              onToggleTag={handleToggleTag}
              onSave={handleCollectionSave}
              onClose={handleCollectionClose}
            />
          )}
        </AnimatePresence>

        {!isExporting && (
          <div className="pointer-events-none absolute bottom-2 left-1/2 z-20 flex w-full -translate-x-1/2 flex-col items-center gap-1 px-3 pb-4">
            <AnimatePresence mode="wait">
              {showingFlyingComment && (
                <motion.div
                  key={activeComment.key}
                  initial={{ x: commentStartX }}
                  animate={{ x: commentEndX }}
                  exit={{ opacity: 0, transition: { duration: 0.18 } }}
                  transition={{
                    x: {
                      duration:
                        getCommentFlightDuration(getFloatingCommentLabel(activeCommentLabel)) /
                        1000,
                      ease: "linear",
                    },
                  }}
                  // Dim the bottom-left info only while this chip is actually over
                  // it. State flips just twice per flight (enter/exit the band).
                  onUpdate={(latest) => {
                    const x =
                      typeof latest.x === "number" ? latest.x : parseFloat(String(latest.x));
                    const overlapping = x <= commentOverlapEnterX && x >= commentOverlapExitX;
                    setCommentOverlapsInfo((prev) => (prev === overlapping ? prev : overlapping));
                  }}
                  onAnimationComplete={() => setCommentOverlapsInfo(false)}
                  className="pointer-events-auto z-30 flex flex-col items-center gap-0.5"
                  style={{ maxWidth: commentMaxWidth }}
                >
                  <div className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-white/75">
                    {activeCommentAuthor ? (
                      <Link
                        to="/u/$username"
                        params={{ username: activeCommentAuthor.username }}
                        onClick={(event) => event.stopPropagation()}
                        className="font-bold text-white drop-shadow"
                      >
                        @{activeCommentAuthor.username}
                      </Link>
                    ) : (
                      <span className="drop-shadow">someone</span>
                    )}
                  </div>
                  <div className="relative max-w-full rounded-2xl bg-white px-3 py-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.45)] ring-1 ring-black/5">
                    <p className="text-center text-sm font-semibold leading-snug text-black">
                      {getFloatingCommentLabel(activeCommentLabel)}
                    </p>
                  </div>
                  <span className="font-mono text-[8px] uppercase tracking-wider text-white/50">
                    {formatShortDateTime(activeComment.created_at)}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {!isExporting && (
          <div
            className={`absolute bottom-4 left-4 z-20 max-w-[min(70%,260px)] text-white transition-opacity duration-300 ${
              commentOverlapsInfo ? "opacity-20" : "opacity-100"
            }`}
          >
            {articlePreview && (
              <a
                href={articlePreview.url}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
                aria-label={`Open article on ${articlePreview.host}`}
                className="group mb-3 inline-flex max-w-full items-center gap-2 rounded-full bg-white py-1.5 pl-2.5 pr-2 text-[10.5px] font-bold uppercase tracking-[0.16em] text-black shadow-[0_14px_38px_rgba(0,0,0,0.55)] ring-1 ring-black/5 transition active:scale-[0.97]"
              >
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-black/[0.06]">
                  <Link2 className="size-3" />
                </span>
                <span className="truncate font-mono text-[10px] font-semibold normal-case tracking-tight text-black/65">
                  {articlePreview.host}
                </span>
                <ArrowUpRight className="size-3.5 shrink-0 text-black/55 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
            )}

            {postHashtags.length > 0 && (
              <div className="mb-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                {postHashtags.map((tag) => (
                  <span
                    key={tag}
                    className="font-mono text-[11px] font-black uppercase leading-none tracking-[0.16em] text-white"
                    style={{
                      textShadow: "0 1px 12px rgba(0,0,0,0.6), 0 1px 2px rgba(0,0,0,0.7)",
                    }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <p
              className="flex items-baseline gap-1.5 font-mono text-[9.5px] uppercase leading-none tracking-[0.22em] text-white/65"
              style={{ textShadow: "0 1px 8px rgba(0,0,0,0.55)" }}
            >
              <span className="text-white/90">{formatCompactCount(viewCount)} views</span>
              <span className="text-white/30">·</span>
              <span>{formatPostDate(post.created_at)}</span>
            </p>
          </div>
        )}

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

        <AnimatePresence>
          {!isExporting && storyOpen && activeStory && (
            <CommentStoryPlayer
              story={activeStory}
              author={profilesById.get(activeStory.user_id)}
              storyCount={commentStories.length}
              storyIndex={storyIndex}
              storyPage={storyPage}
              storyPageCount={storyPages.length}
              pageText={storyPageText}
              playKey={storyPlayKey}
              fastMode={storyFastMode}
              onClose={closeCommentStories}
              onToggleFast={() => setStoryFastMode((fast) => !fast)}
              onDragEnd={handleStoryDrag}
            />
          )}
        </AnimatePresence>

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
      </article>
    </section>
  );
}

function ExportWatermark({ author }: { author?: Profile }) {
  return (
    <div className="pointer-events-none absolute right-4 top-4 z-20 flex items-center gap-2 rounded-full bg-black/18 px-2.5 py-2 text-white shadow-[0_8px_28px_rgba(0,0,0,0.25)] ring-1 ring-white/20 backdrop-blur-[2px]">
      <span className="grid size-7 place-items-center rounded-full bg-white text-[13px] font-black leading-none text-black shadow-[0_4px_18px_rgba(0,0,0,0.25)]">
        K
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-mono text-[10px] font-black uppercase tracking-[0.22em] text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.6)]">
          Kinetic
        </span>
        <span className="mt-1 max-w-24 truncate font-mono text-[8px] uppercase tracking-[0.14em] text-white/70 drop-shadow-[0_1px_8px_rgba(0,0,0,0.65)]">
          (C) {author ? `@${author.username}` : "original"}
        </span>
      </span>
    </div>
  );
}

function PostMenuRail({ onExport, isExporting }: { onExport: () => void; isExporting: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="absolute right-3 top-[62px] z-30 flex origin-top-right flex-col items-end gap-2"
      onClick={(event) => event.stopPropagation()}
    >
      <RailMenuLink to="/create" label="create" icon={<Plus className="size-5" />} emphasized />
      <RailMenuButton
        label={isExporting ? "exporting" : "export"}
        icon={<Download className="size-4" />}
        onClick={onExport}
        disabled={isExporting}
      />
      <RailMenuLink to="/feed" label="feed" icon={<Home className="size-4" />} />
      <RailMenuLink to="/discover" label="discover" icon={<Search className="size-4" />} />
      <RailMenuLink to="/notifications" label="activity" icon={<Bell className="size-4" />} />
      <RailMenuLink to="/me" label="profile" icon={<User className="size-4" />} />
      <RailMenuLink to="/settings" label="settings" icon={<Settings className="size-4" />} />
      <RailMenuLink to="/about" label="about" icon={<Info className="size-4" />} />
    </motion.div>
  );
}

function RailMenuButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.button
      type="button"
      whileTap={disabled ? undefined : { scale: 0.93, x: -2 }}
      transition={{ type: "spring", stiffness: 560, damping: 24 }}
      onClick={onClick}
      disabled={disabled}
      className="group flex min-h-10 items-center gap-2 text-white outline-none disabled:opacity-55"
      aria-label={label}
    >
      <span className="pr-1 text-right font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white/75 drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)] transition group-hover:text-white group-active:translate-x-0.5 group-active:text-white">
        {label}
      </span>
      <span className="grid size-10 place-items-center rounded-full bg-black/45 text-white shadow-[0_12px_30px_rgba(0,0,0,0.3)] ring-1 ring-white/15 backdrop-blur transition duration-150 group-active:scale-90 group-active:bg-white group-active:text-black group-active:ring-2 group-active:ring-white/80">
        {icon}
      </span>
    </motion.button>
  );
}

function RailMenuLink({
  to,
  label,
  icon,
  emphasized,
}: {
  to: string;
  label: string;
  icon: ReactNode;
  emphasized?: boolean;
}) {
  return (
    <motion.div
      whileTap={{ scale: 0.93, x: -2 }}
      transition={{ type: "spring", stiffness: 560, damping: 24 }}
    >
      <Link
        to={to}
        className="group flex min-h-10 items-center gap-2 text-white outline-none"
        aria-label={label}
      >
        <span className="pr-1 text-right font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white/75 drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)] transition group-hover:text-white group-active:translate-x-0.5 group-active:text-white">
          {label}
        </span>
        <span
          className={`grid size-10 place-items-center rounded-full shadow-[0_12px_30px_rgba(0,0,0,0.3)] transition duration-150 group-active:scale-90 group-active:ring-2 group-active:ring-white/80 ${
            emphasized
              ? "bg-white text-black group-active:bg-white/85"
              : "bg-black/45 text-white ring-1 ring-white/15 backdrop-blur group-active:bg-white group-active:text-black"
          }`}
        >
          {icon}
        </span>
      </Link>
    </motion.div>
  );
}

function CommentStoryPlayer({
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
}: {
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
}) {
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

function EmbeddedCommentStoryCanvas({
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
}: {
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
}) {
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

function KineticCommentDraftCanvas({
  text,
  pageText,
  page,
  pageCount,
  playKey,
  background,
}: {
  text: string;
  pageText: string;
  page: number;
  pageCount: number;
  playKey: number;
  background: string;
}) {
  return (
    <motion.div
      className="relative mx-auto aspect-[9/16] h-full max-h-full max-w-full overflow-hidden rounded-[24px] text-white shadow-[0_20px_55px_rgba(0,0,0,0.38)] ring-1 ring-white/15"
      initial={{ scale: 0.96 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
    >
      <div aria-hidden className="absolute inset-0" style={{ background }} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_15%,rgba(255,255,255,0.22),transparent_30%),linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.52))]" />
      <AnimatedCommentStoryText
        text={pageText}
        fullText={text}
        playKey={playKey}
        fastMode={false}
        background={background}
      />
      {pageCount > 1 && (
        <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1">
          {Array.from({ length: pageCount }).map((_, index) => (
            <span
              key={index}
              className={`h-1 rounded-full transition ${
                index === page ? "w-5 bg-white" : "w-1 bg-white/35"
              }`}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

function AnimatedCommentStoryText({
  text,
  fullText,
  playKey,
  fastMode,
  background,
}: {
  text: string;
  fullText: string;
  playKey: number;
  fastMode: boolean;
  background: string;
}) {
  const displayText = fastMode ? fullText : text;
  const textColor = getCanvasTextColor({ color: "#ffffff" }, background);
  const commentSpec: CanvasSpec = {
    ...DEFAULT_CANVAS,
    text: displayText,
    font: "Space Grotesk",
    size: fastMode ? 42 : 72,
    color: textColor,
    weight: 900,
    letterSpacing: -0.035,
    x: 50,
    y: 52,
    entrance: "fade",
    loop: "float",
    tempo: "steady",
    rhythm: "stagger",
  };

  if (fastMode) {
    return (
      <div className="absolute inset-x-6 top-[18%] bottom-[16%] z-10 grid place-items-center">
        <motion.p
          key={playKey}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-h-full overflow-hidden text-center font-black leading-[1.02] text-white drop-shadow-[0_8px_34px_rgba(0,0,0,0.55)]"
          style={{ color: textColor, fontSize: "clamp(1.15rem, 3.5vh, 1.85rem)" }}
        >
          {displayText}
        </motion.p>
      </div>
    );
  }

  return (
    <WordSequenceText
      spec={commentSpec}
      playKey={playKey}
      paused={false}
      revealed={false}
      canvasWidth={390}
      background={background}
      entranceSeed={fullText}
    />
  );
}

export function paginateText(text: string) {
  const blocks = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((block) => block.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
  if (blocks.length === 0) return [""];

  return mergeShortTextPages(blocks.flatMap((block) => paginateTextBlock(block)));
}

// A single-word page (e.g. a one-word reveal). It cannot wrap, so it is sized on
// its own to fit the screen rather than being held to the shared page size.
function isSoloTextPage(text: string) {
  return getWords(text).length <= 1;
}

// A page plus whether it may be merged backwards. Only "mergeable" pages — the
// overflow continuations created when a single sentence is split because it
// exceeds the word limit — can be pulled back to avoid a 1-2 word orphan.
// Deliberate pages (a whole newline block / a complete sentence, e.g. a one-word
// reveal) are never merged, even when short.
type RawTextPage = { text: string; mergeable: boolean };

function paginateTextBlock(text: string): RawTextPage[] {
  const wordLimit = getTextPageWordLimit(text);
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [text];
  return sentences
    .flatMap((sentence) => chunkSentenceByWords(sentence.trim(), wordLimit))
    .filter((page) => page.text);
}

function chunkSentenceByWords(sentence: string, wordLimit: number): RawTextPage[] {
  const words = sentence.match(/\S+/g) ?? [];
  if (words.length <= wordLimit) return [{ text: sentence, mergeable: false }];

  const units = getTextPageUnits(words);
  const pageCount = Math.ceil(words.length / wordLimit);
  const targetWordsPerPage = Math.ceil(words.length / pageCount);
  const chunks: string[] = [];
  let currentWords: string[] = [];
  let currentWeight = 0;

  const flush = () => {
    if (currentWords.length === 0) return;
    chunks.push(currentWords.join(" "));
    currentWords = [];
    currentWeight = 0;
  };

  const retreatToLastNaturalBreak = () => {
    const breakIndex = findLastNaturalBreakIndex(currentWords);
    if (breakIndex < 0 || breakIndex >= currentWords.length - 1) return false;
    const head = currentWords.slice(0, breakIndex + 1);
    const tail = currentWords.slice(breakIndex + 1);
    chunks.push(head.join(" "));
    currentWords = tail;
    currentWeight = tail.length;
    return true;
  };

  for (const unit of units) {
    const wouldOverflow =
      currentWords.length > 0 && currentWeight + unit.weight > targetWordsPerPage;

    if (wouldOverflow) {
      // Back up to the last comma / full stop instead of splitting mid-phrase
      // (e.g. keep "tốc độ" together on the next page).
      if (!retreatToLastNaturalBreak()) {
        flush();
      }
    }

    currentWords.push(...unit.words);
    currentWeight += unit.weight;

    // After a full stop or completed hyphen phrase, close the page.
    if (shouldEndTextPageAfterUnit(unit)) {
      flush();
    }
  }

  flush();

  if (chunks.length <= 1) {
    return [{ text: sentence, mergeable: false }];
  }

  // The first chunk heads the sentence (deliberate); later chunks are overflow
  // continuations that may merge back if they end up too short.
  return chunks.map((text, index) => ({ text, mergeable: index > 0 }));
}

function findLastNaturalBreakIndex(words: string[]) {
  for (let index = words.length - 1; index >= 0; index--) {
    const word = words[index] ?? "";
    if (/[.!?]["')\]]*$/.test(word)) return index;
    if (/[,;:]["')\]]*$/.test(word)) return index;
  }
  return -1;
}

function shouldEndTextPageAfterUnit(unit: TextPageUnit) {
  const lastWord = unit.words[unit.words.length - 1] ?? "";
  if (/[.!?]["')\]]*$/.test(lastWord)) return true;
  return unit.words.some((word) => isStandaloneHyphen(word));
}

type TextPageUnit = {
  words: string[];
  weight: number;
};

function getTextPageUnits(words: string[]): TextPageUnit[] {
  const units: TextPageUnit[] = [];

  for (let index = 0; index < words.length; ) {
    if (index + 2 < words.length && isStandaloneHyphen(words[index + 1])) {
      units.push({ words: words.slice(index, index + 3), weight: 3 });
      index += 3;
      continue;
    }

    if (index + 1 < words.length && isStandaloneHyphen(words[index])) {
      units.push({ words: words.slice(index, index + 2), weight: 2 });
      index += 2;
      continue;
    }

    units.push({ words: [words[index]], weight: 1 });
    index += 1;
  }

  return units;
}

function isStandaloneHyphen(word: string) {
  return /^[-–—]+$/.test(word.trim());
}

const MIN_STANDALONE_PAGE_WORDS = 3;

// Anti-orphan: only overflow continuations may merge; deliberate pages stay.
function mergeShortTextPages(pages: RawTextPage[]) {
  const merged: RawTextPage[] = [];

  for (const page of pages) {
    const normalized = page.text.trim();
    if (!normalized) continue;

    // Pull a short page back ONLY when it is an overflow continuation of the
    // previous page — a deliberate short page (whole line / one-word reveal)
    // always keeps its own page.
    if (
      page.mergeable &&
      getWords(normalized).length < MIN_STANDALONE_PAGE_WORDS &&
      merged.length > 0
    ) {
      merged[merged.length - 1].text = joinTextPages(merged[merged.length - 1].text, normalized);
      continue;
    }

    merged.push({ text: normalized, mergeable: page.mergeable });
  }

  return merged.map((page) => page.text);
}

function joinTextPages(left: string, right: string) {
  return `${left.trim()} ${right.trim()}`.trim();
}

const MIN_FONT_SIZE = 64;

function getUniformPageTextSize(baseSize: number, pages: string[], fullText: string): number {
  // Single page: use its optimal size
  if (pages.length <= 1) {
    return Math.max(
      MIN_FONT_SIZE,
      getPageTextSize(baseSize, pages[0] ?? "", isLikelyVietnameseText(fullText)),
    );
  }

  // Multi-page: find the SMALLEST page (fewest words) to determine a uniform
  // size that works for all. This makes all pages display large and consistent.
  // Never shrinks below MIN_FONT_SIZE.
  const isVietnamese = isLikelyVietnameseText(fullText);
  const minWordCount = Math.min(...pages.map((p) => getWords(p).length));

  let size: number;
  if (isVietnamese) {
    if (minWordCount >= 9) size = Math.min(baseSize, 78);
    else if (minWordCount >= 7) size = Math.min(baseSize, 84);
    else if (minWordCount >= 5) size = Math.min(baseSize, 92);
    else if (minWordCount >= 3) size = Math.min(baseSize, 104);
    else size = baseSize;
  } else {
    // English: bump size based on min word count (smaller pages get larger fonts)
    if (minWordCount >= 14) size = Math.max(baseSize, 80);
    else if (minWordCount >= 10) size = Math.max(baseSize, 86);
    else if (minWordCount >= 6) size = Math.max(baseSize, 92);
    else size = Math.max(baseSize, 96);
  }

  return Math.max(MIN_FONT_SIZE, size);
}

function getPageTextSize(baseSize: number, text: string, isVietnamese: boolean) {
  const wordCount = getWords(text).length;
  if (isVietnamese) {
    if (wordCount >= 9) return Math.min(baseSize, 78);
    if (wordCount >= 7) return Math.min(baseSize, 84);
    if (wordCount >= 5) return Math.min(baseSize, 92);
    if (wordCount >= 3) return Math.min(baseSize, 104);
    return baseSize;
  }
  // English text: bump base size so it fills the canvas like Vietnamese posts.
  if (wordCount >= 14) return Math.max(baseSize, 80);
  if (wordCount >= 10) return Math.max(baseSize, 86);
  if (wordCount >= 6) return Math.max(baseSize, 92);
  return Math.max(baseSize, 96);
}

function getPageDuration(text: string, tempo: Tempo, rhythm: Rhythm) {
  const wordCount = getWords(text).length;
  const base = Math.max(3200, Math.min(5200, 1900 + wordCount * 430));
  const rhythmMultiplier = rhythm === "poetic" ? 1.18 : 1;
  return base * tempoConfig[tempo].pageMultiplier * rhythmMultiplier;
}

function getPostExportDuration(pages: string[], tempo: Tempo, rhythm: Rhythm) {
  const onePass = pages.reduce(
    (duration, page) => duration + getPageDuration(page, tempo, rhythm),
    0,
  );
  return Math.max(3600, onePass + 650);
}

function getSupportedExportMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  return (
    [
      "video/mp4;codecs=h264",
      "video/mp4;codecs=avc1",
      "video/mp4",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ].find((type) => MediaRecorder.isTypeSupported(type)) ?? ""
  );
}

function getExportExtension(mimeType: string) {
  return mimeType.includes("mp4") ? "mp4" : "webm";
}

function getPostExportFilename(post: Post, mimeType: string) {
  return `kinetic-${post.id.slice(0, 8)}.${getExportExtension(mimeType)}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function getCommentFlightDuration(label: string) {
  return Math.max(5600, Math.min(8400, 4300 + label.length * 55));
}

function getLoopAnimation(loop: CanvasSpec["loop"], tempo: Tempo) {
  if (loop === "none") return undefined;
  return `kinetic-${loop} ${tempoConfig[tempo].loopSeconds}s ease-in-out infinite`;
}

function getWordDelay(index: number, tempo: Tempo, rhythm: Rhythm) {
  const base = tempoConfig[tempo].wordDelay;
  if (rhythm === "poetic") return index * base * 1.45;
  if (rhythm === "smooth") return index * base * 0.58;
  if (rhythm === "burst") return Math.min(index * base * 0.42, 0.38);
  return index * base;
}

function getFloatingCommentLabel(label: string) {
  const words = getWords(label);
  if (words.length <= 10 && label.length <= 84) return label;
  const preview = words.slice(0, 10).join(" ");
  return `${preview}...`;
}

function shouldFloatComment(label: string) {
  return getCommentWordCount(label) <= FLOATING_COMMENT_MAX_WORDS;
}

function getCommentWordCount(label: string) {
  return label.match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu)?.length ?? 0;
}

function getCommentStoryPages(text: string, fastMode: boolean) {
  const normalized = normalizeComment(text);
  if (!normalized) return [""];
  if (fastMode) return [normalized];

  const words = getWords(normalized);
  if (words.length <= COMMENT_STORY_WORDS_PER_PAGE) return [normalized];

  const pages: string[] = [];
  for (let i = 0; i < words.length; i += COMMENT_STORY_WORDS_PER_PAGE) {
    pages.push(words.slice(i, i + COMMENT_STORY_WORDS_PER_PAGE).join(" "));
  }
  return pages;
}

function getStoryPageDuration(text: string) {
  const wordCount = getWords(text).length;
  return Math.max(2600, Math.min(5200, 1500 + wordCount * 360));
}

function getFastStoryDuration(text: string) {
  const wordCount = getWords(text).length;
  return Math.max(3200, Math.min(7600, 1700 + wordCount * 150));
}

function getCommentStoryGradient(index: number) {
  const gradients = [
    "linear-gradient(135deg,#FF006E,#8338EC)",
    "linear-gradient(135deg,#06FFA5,#118AB2)",
    "linear-gradient(135deg,#FFBE0B,#FB5607)",
    "linear-gradient(135deg,#3A86FF,#7209B7)",
    DEFAULT_CANVAS_BACKGROUND,
  ];
  return gradients[index % gradients.length];
}

function getGradientTransitionPath(spec: CanvasSpec) {
  if (spec.backgroundStyle !== "transition") return [];
  return (spec.gradientPath ?? [])
    .map((gradient) => gradient.trim())
    .filter((gradient) => isUsableCanvasBackground(gradient));
}

function getResolvedPostBackground(post: Post) {
  return resolveCanvasBackground(post.bg_gradient, post.id);
}

function getSlidingCanvasBackground(spec: CanvasSpec, fallback: string | null, shiftPage: number) {
  const colors = getTransitionColorCycle(spec, fallback);
  if (colors.length < 2) return null;

  const segmentCount = Math.max(64, colors.length * 12);
  const stripColors = Array.from(
    { length: segmentCount + 1 },
    (_, index) => colors[index % colors.length],
  );
  const stops = stripColors
    .map((color, index) => `${color} ${((index / segmentCount) * 100).toFixed(3)}%`)
    .join(", ");

  return {
    background: `linear-gradient(100deg, ${stops})`,
    width: `${segmentCount * 100}%`,
    x: `-${shiftPage * (100 / segmentCount)}%`,
  };
}

function getTransitionColorCycle(spec: CanvasSpec, fallback: string | null) {
  const gradients = getGradientTransitionPath(spec);
  const colors = gradients.reduce<string[]>((items, gradient, index) => {
    const stops = extractGradientColors(gradient).filter(
      (color) => !isTooDarkCanvasBackground(color),
    );
    if (stops.length < 2) return items;
    if (index === 0) items.push(stops[0]);
    items.push(stops[stops.length - 1]);
    return items;
  }, []);

  const fallbackStops = fallback
    ? extractGradientColors(fallback).filter((color) => !isTooDarkCanvasBackground(color))
    : [];
  const defaultStops = extractGradientColors(DEFAULT_CANVAS_BACKGROUND);
  const cycle =
    colors.length >= 2 ? colors : fallbackStops.length >= 2 ? fallbackStops : defaultStops;
  if (cycle.length < 2) return [];
  return cycle[0] === cycle[cycle.length - 1] ? cycle.slice(0, -1) : cycle;
}

function extractGradientColors(value: string) {
  return (
    value.match(
      /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\)|color\([^)]*\)/g,
    ) ?? []
  );
}

function getPostHashtags(text: string, postType: string, pages?: string[]) {
  const explicitTags = Array.from(text.matchAll(/#([a-z0-9][a-z0-9_-]{1,24})/gi)).map((match) =>
    normalizeHashtag(match[1]),
  );
  // Never derive a tag from the final page of a multi-page post — it is the
  // reveal/punchline (e.g. a guessing game's answer), and tagging it would spoil
  // the mystery right under the post.
  const tagSource = pages && pages.length > 1 ? pages.slice(0, -1).join(" ") : text;
  const textTags = getWords(tagSource)
    .map(normalizeHashtag)
    .filter((tag) => tag.length >= 4 && !STOP_WORDS.has(tag));
  const typeTag = normalizeHashtag(postType);
  const tags = [...explicitTags, ...textTags, typeTag, "kinetic"];
  return Array.from(new Set(tags.filter(Boolean))).slice(0, 3);
}

function normalizeHashtag(value: string) {
  return value
    .toLowerCase()
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 18);
}

function getPostViewCount(post: Post, likes: number, comments: number) {
  const timestamp = new Date(post.created_at).getTime();
  const ageHours = Number.isNaN(timestamp) ? 24 : Math.max(1, (Date.now() - timestamp) / 3_600_000);
  const seed = getStableNumber(post.id);
  const base = 280 + (seed % 6800);
  const recencyLift = Math.round(1800 / Math.sqrt(ageHours));
  return Math.max(24, base + recencyLift + likes * 73 + comments * 41);
}

function getStableNumber(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function formatCompactCount(count: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: count < 10_000 ? 1 : 0,
  }).format(count);
}

function WordSequenceText({
  spec,
  playKey,
  paused,
  revealed,
  canvasWidth,
  measure = false,
  onFitScale,
  disableFit = false,
  background,
  photoBackdrop = false,
  entranceSeed,
}: {
  spec: CanvasSpec;
  playKey: number;
  paused: boolean;
  revealed: boolean;
  canvasWidth: number;
  // measure: render static + invisible, only to report the fit scale this page needs.
  measure?: boolean;
  onFitScale?: (scale: number) => void;
  // disableFit: spec.size is already the shared, pre-fitted size — skip per-page shrink.
  disableFit?: boolean;
  background?: string | null;
  photoBackdrop?: boolean;
  // Stable seed (the full post text) so every page of one post shares the same
  // auto-picked entrance personality. Falls back to the page text when absent.
  entranceSeed?: string;
}) {
  const words = getWords(spec.text);
  // A solo reveal word is measured post-emphasis via scrollWidth (see
  // getMeasuredTextWidth below), and has no neighbor to protect from overlap —
  // so it must skip the emphasis fit guard further down, which exists only to
  // stop a multi-word line's emphasized word from crowding its neighbors.
  const isSolo = words.length <= 1;
  const entranceStyle = getEntranceStyle(entranceSeed ?? spec.text, spec.rhythm);
  const isVietnamese = isLikelyVietnameseText(spec.text);
  const vietnameseLines = isVietnamese ? getVietnameseWordLines(words) : [];
  const emphasized = getEmphasizedWordIndexes(words);
  const layoutMode = getKineticTextLayoutMode(spec.text, isVietnamese, words.length, emphasized);
  const leftAnchoredText = layoutMode !== "center";
  const spotlightEmphasis = layoutMode === "left-spotlight";
  const tempo = tempoConfig[spec.tempo];
  const visualScaleGuard = Math.max(
    emphasized.size > 0 && !isSolo ? EMPHASIS_SCALE_FIT_GUARD : 1,
    isVietnamese ? VIETNAMESE_SCALE_FIT_GUARD : 1,
  );
  // A solo reveal word fits itself (it never joins the shared sizing), so size
  // it the moment it renders instead of waiting for the layout effect: this
  // predicted fit guarantees the first painted frame — including server-rendered
  // markup that no effect ever touches — is already inside the canvas, never the
  // full-width overflow the effect would otherwise have to claw back.
  const soloInitialFit =
    isSolo && !disableFit
      ? estimateSoloRevealFit(
          spec.text,
          spec.size,
          canvasWidth,
          visualScaleGuard,
          spec.font,
          spec.weight,
          emphasized.size > 0 ? EMPHASIS_FONT_SCALE : 1,
        )
      : 1;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(soloInitialFit);
  const [soloInlineScale, setSoloInlineScale] = useState(1);
  const [safeCenterY, setSafeCenterY] = useState(spec.y);
  const staticRender = revealed || measure;
  const fontSize = spec.size * (disableFit ? 1 : fitScale);
  const textColor = photoBackdrop
    ? resolveTextColorOnPhotoBackdrop(spec)
    : getCanvasTextColor(spec, background);
  const emphasisColor = getCanvasEmphasisColor({ ...spec, color: textColor }, background);
  const photoTextShadow = photoBackdrop ? getPhotoBackdropTextShadow(textColor) : undefined;
  const textSafeMaxWidth = hasVisibleStickerAccent(spec.stickers, spec.text)
    ? "min(90%, calc(100% - 2.5rem))"
    : TEXT_SAFE_MAX_WIDTH;

  useIsomorphicLayoutEffect(() => {
    setFitScale(soloInitialFit);
    setSoloInlineScale(1);
    setSafeCenterY(spec.y);
  }, [
    soloInitialFit,
    canvasWidth,
    background,
    spec.color,
    spec.font,
    spec.letterSpacing,
    spec.rotation,
    spec.size,
    spec.text,
    spec.weight,
    spec.y,
  ]);

  useIsomorphicLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const text = textRef.current;
    const canvas = wrapper?.parentElement?.parentElement;
    if (!wrapper || !text || !canvas) return;

    const wrapperWidth = wrapper.clientWidth;
    const canvasHeight = canvas.getBoundingClientRect().height;
    if (!wrapperWidth || !canvasHeight) return;

    const safeInsets = getTextSafeInsets(canvasHeight);
    const safeHeight = Math.max(160, canvasHeight - safeInsets.top - safeInsets.bottom);
    const maxHeight = safeHeight * 0.92;
    // A solo page's text container is forced to width:100% (see the textRef
    // style below) so it centers within the wrapper — its scrollWidth is just
    // that 100% width, not the word's actual glyph width. Measure the
    // innermost word span directly instead, undoing the scaleX already
    // applied so we recover the word's true intrinsic width.
    const measuredWidth = isSolo
      ? getMeasuredSoloWordWidth(text, soloInlineScale)
      : getMeasuredTextWidth(text, wrapper, leftAnchoredText);
    const widthRatio = wrapperWidth / Math.max(measuredWidth * visualScaleGuard, 1);
    const heightRatio = maxHeight / Math.max(text.scrollHeight, 1);
    // A single word cannot wrap, so the usual immersive minimums must not block
    // it from shrinking enough to fit. For reveal words, keep the letters tall
    // and condense the word horizontally only when that is needed to stay inside
    // the canvas bounds.
    const finalSizeFloor = Math.min(1, MIN_FONT_SIZE / Math.max(spec.size, 1));
    const floor = isSolo
      ? SOLO_TEXT_MIN_FIT
      : Math.max(isVietnamese ? MIN_TEXT_FIT_SCALE : MIN_ENGLISH_TEXT_FIT_SCALE, finalSizeFloor);
    const widthFit = Math.min(1, fitScale * widthRatio * 0.98);
    const heightFit = Math.min(1, fitScale * heightRatio * 0.98);
    // The hard safety boundary (uncapped) — the actual scale beyond which the
    // word would spill outside the wrapper/safe-height. Unlike widthFit/heightFit
    // above (capped at the page's own configured size), this is allowed to exceed
    // 1 so a short reveal word can grow past its nominal size.
    const widthFitRaw = fitScale * widthRatio * 0.98;
    const heightFitRaw = fitScale * heightRatio * 0.98;
    // A solo reveal word is the punchline — it should be the single biggest,
    // boldest moment on the page, not capped at the body lines' font size. Solve
    // directly for the scale that makes the word fill the target share of the
    // real canvas width (grows past 1x for short words, shrinks for long ones),
    // then let the height ceiling and a soft floor bound it.
    const targetWidthRatio =
      (canvasWidth * SOLO_REVEAL_TARGET_WIDTH_FRACTION) /
      Math.max(measuredWidth * visualScaleGuard, 1);
    const widthFitTarget = fitScale * targetWidthRatio;
    const nextFit = isSolo
      ? Math.max(floor, Math.min(Math.max(widthFitTarget, SOLO_REVEAL_MIN_FIT), heightFitRaw))
      : Math.max(floor, Math.min(1, widthFit, heightFit));
    // Close any remaining gap between the chosen font scale and the target width
    // with a horizontal-only stretch/squish so the letters stay their full height
    // even when the height ceiling capped the font scale below the target, or the
    // soft floor held it above what the long word's true fit would allow.
    const nextSoloInlineScale = isSolo
      ? clampNumber(
          Math.min(widthFitTarget, widthFitRaw) / Math.max(nextFit, 0.01),
          SOLO_REVEAL_MIN_INLINE_SCALE,
          SOLO_REVEAL_MAX_STRETCH,
        )
      : 1;
    const textHeight = text.scrollHeight;
    const requestedCenter = (canvasHeight * spec.y) / 100;
    const halfText = Math.min(textHeight / 2, safeHeight / 2);
    const minCenter = safeInsets.top + halfText;
    const maxCenter = canvasHeight - safeInsets.bottom - halfText;
    const nextCenterY =
      minCenter <= maxCenter
        ? (clampNumber(requestedCenter, minCenter, maxCenter) / canvasHeight) * 100
        : ((safeInsets.top + safeHeight / 2) / canvasHeight) * 100;

    // Solo pages may need to grow fitScale past its initial 1 (to fill the
    // target width), not just shrink — react to either direction. Multi-word
    // pages never compute a nextFit above 1, so this stays shrink-only for them.
    if (!disableFit && Math.abs(nextFit - fitScale) > 0.01) {
      setFitScale(nextFit);
    } else {
      // Converged — report the scale this page needs so the parent can pick a
      // single shared size that keeps every page the same immersive size.
      onFitScale?.(nextFit);
    }
    if (Math.abs(nextSoloInlineScale - soloInlineScale) > 0.01) {
      setSoloInlineScale(nextSoloInlineScale);
    }
    if (Math.abs(nextCenterY - safeCenterY) > 0.2) {
      setSafeCenterY(nextCenterY);
    }
  }, [
    disableFit,
    onFitScale,
    fitScale,
    fontSize,
    canvasWidth,
    spec.font,
    spec.letterSpacing,
    spec.rotation,
    spec.size,
    spec.text,
    spec.weight,
    spec.y,
    isVietnamese,
    leftAnchoredText,
    visualScaleGuard,
    soloInlineScale,
    safeCenterY,
  ]);

  const renderWord = (word: string, index: number, suppressSpotlight = false) => {
    const important = emphasized.has(index);
    const spotlightWord = spotlightEmphasis && important && !suppressSpotlight;
    const emphasisVariant = important
      ? getEmphasisVariant(spec.text, word, index, !isDimEmphasisColor(emphasisColor))
      : null;
    const wordColor = important
      ? getCanvasEmphasisWordColor(emphasisVariant, textColor, emphasisColor)
      : textColor;
    const entranceDelay = staticRender ? 0 : getWordDelay(index, spec.tempo, spec.rhythm);
    const rhythmDurationMultiplier = spec.rhythm === "poetic" ? 1.28 : 1;
    const entranceDuration = staticRender
      ? 0.01
      : (important ? tempo.wordDuration * 1.22 : tempo.wordDuration) * rhythmDurationMultiplier;
    const emphasisStyle = important
      ? ({
          "--kinetic-emphasis-delay": `${entranceDelay + entranceDuration + 0.18}s`,
          ...(emphasisVariant === "halo" || emphasisVariant === "glow"
            ? { "--kinetic-aura-color": getAuraColor(textColor) }
            : {}),
        } as CSSProperties)
      : undefined;
    // Bake the play-state into the animation shorthand so we never mix the
    // `animation` shorthand with the `animationPlayState` longhand (React warns).
    const innerAnimation = important
      ? getEmphasisInnerAnimation(emphasisVariant, staticRender)
      : undefined;
    const isSoloRevealWord = isSolo;
    return (
      <motion.span
        key={`${word}-${index}`}
        data-kinetic-word={getWordAnchorKey(word)}
        data-kinetic-word-index={index}
        variants={{
          // The starting pose comes from the post's auto-picked entrance style;
          // every style settles to the shared neutral rest below. Emphasis size
          // is applied via fontSize (not scale), so settling to scale 1 keeps the
          // enlarged word from overlapping its neighbors.
          hidden: getEntranceHidden(entranceStyle, important, index),
          show: ENTRANCE_REST,
        }}
        transition={getEntranceTransition(entranceStyle, entranceDelay, entranceDuration)}
        className={important ? "relative inline-flex" : "inline-flex"}
        style={{
          color: wordColor,
          display: spotlightWord ? "inline-flex" : "inline-block",
          flexBasis: spotlightWord ? "100%" : undefined,
          justifyContent: spotlightWord ? "center" : undefined,
          textAlign: spotlightWord ? "center" : undefined,
          // Emphasized words render larger via fontSize so the extra width is
          // reserved in the flex flow (transform: scale would overlap neighbors).
          fontSize: important ? `${EMPHASIS_FONT_SCALE}em` : undefined,
          fontWeight: important ? 900 : spec.weight,
          overflowWrap: "normal",
          whiteSpace: "nowrap",
          wordBreak: "normal",
          textShadow: important
            ? getEmphasisTextShadow(emphasisVariant)
            : "0 4px 40px rgba(0,0,0,0.45)",
          animationPlayState: paused ? "paused" : "running",
          transformOrigin: leftAnchoredText && !spotlightWord ? "left center" : "center",
          // Small breathing room on top of the reserved fontSize width so the
          // bolder glyphs never kiss the adjacent words.
          marginTop: spotlightWord ? "0.08em" : undefined,
          marginBottom: spotlightWord ? "0.08em" : undefined,
          marginLeft:
            important && !spotlightWord
              ? emphasisVariant === "frame"
                ? "0.18em"
                : "0.06em"
              : undefined,
          marginRight:
            important && !spotlightWord
              ? emphasisVariant === "frame"
                ? "0.18em"
                : "0.06em"
              : undefined,
        }}
      >
        <span
          style={{
            display: "inline-block",
            transform: isSoloRevealWord ? `scaleX(${soloInlineScale})` : undefined,
            transformOrigin: "center",
          }}
        >
          <span
            className={
              important
                ? `kinetic-emphasis-mark${
                    emphasisVariant === "halo"
                      ? " kinetic-emph-halo"
                      : emphasisVariant === "frame"
                        ? " kinetic-emph-frame"
                        : emphasisVariant === "underline"
                          ? " kinetic-emph-underline"
                          : emphasisVariant === "sweep"
                            ? " kinetic-emph-sweep"
                            : ""
                  }${staticRender ? "" : " is-animated"}`
                : undefined
            }
            style={{
              ...emphasisStyle,
              animation: innerAnimation
                ? `${innerAnimation} ${paused ? "paused" : "running"}`
                : undefined,
            }}
          >
            {word}
          </span>
        </span>
      </motion.span>
    );
  };

  const loopAnimation = getLoopAnimation(spec.loop, spec.tempo);

  return (
    <div
      ref={wrapperRef}
      aria-hidden={measure || undefined}
      className="pointer-events-none absolute select-none"
      style={{
        left: `${spec.x}%`,
        top: `${safeCenterY}%`,
        transform: "translate(-50%, -50%)",
        width: textSafeMaxWidth,
        maxWidth: textSafeMaxWidth,
        visibility: measure ? "hidden" : undefined,
      }}
    >
      <motion.div
        ref={textRef}
        key={`${playKey}-${staticRender ? "revealed" : "animated"}`}
        className={
          isVietnamese
            ? "flex flex-col items-stretch"
            : leftAnchoredText
              ? "flex flex-wrap items-baseline justify-start"
              : "flex flex-wrap items-center justify-center"
        }
        initial={staticRender ? false : "hidden"}
        animate="show"
        style={{
          width: "100%",
          columnGap: isVietnamese ? undefined : "0.34em",
          rowGap: isVietnamese ? undefined : "0.08em",
          fontFamily: spec.font,
          fontSize,
          color: textColor,
          fontWeight: spec.weight,
          letterSpacing: `${spec.letterSpacing}em`,
          lineHeight: isVietnamese ? 1.04 : 0.9,
          textAlign: leftAnchoredText ? "left" : "center",
          textShadow: photoTextShadow ?? "0 4px 40px rgba(0,0,0,0.45)",
          transform: `rotate(${spec.rotation}deg)`,
          animation: loopAnimation
            ? `${loopAnimation} ${paused ? "paused" : "running"}`
            : undefined,
        }}
      >
        {isVietnamese
          ? vietnameseLines.map((line, lineIndex) => (
              <div
                key={`${lineIndex}-${line.indentEm}`}
                className="flex flex-wrap items-baseline justify-start"
                style={{
                  alignSelf: "stretch",
                  boxSizing: "border-box",
                  columnGap: "0.24em",
                  rowGap: "0.08em",
                  marginTop: lineIndex === 0 ? 0 : "0.06em",
                  minWidth: 0,
                  paddingLeft: `${line.indentEm}em`,
                  paddingRight: "2%",
                  width: "100%",
                }}
              >
                {line.segments.map((segment) => {
                  const spotlightSegment =
                    spotlightEmphasis && segment.words.some(({ index }) => emphasized.has(index));
                  return (
                    <span
                      key={segment.key}
                      className="inline-flex flex-nowrap items-baseline whitespace-nowrap"
                      style={{
                        columnGap: "0.24em",
                        flexBasis: spotlightSegment ? "100%" : undefined,
                        justifyContent: spotlightSegment ? "center" : undefined,
                        marginBottom: spotlightSegment ? "0.08em" : undefined,
                        marginTop: spotlightSegment ? "0.08em" : undefined,
                      }}
                    >
                      {segment.words.map(({ text, index }) => renderWord(text, index, true))}
                    </span>
                  );
                })}
              </div>
            ))
          : words.map((word, index) => renderWord(word, index))}
      </motion.div>
    </div>
  );
}

function getKineticTextLayoutMode(
  text: string,
  isVietnamese: boolean,
  wordCount: number,
  emphasized: Set<number>,
) {
  const hasEmphasis = emphasized.size > 0;
  const seed = getStableNumber(text);
  if (isVietnamese) return hasEmphasis && seed % 4 === 0 ? "left-spotlight" : "left";
  if (wordCount <= 3) return "center";
  if (hasEmphasis && seed % 5 === 0) return "left-spotlight";
  return seed % 2 === 0 || wordCount >= 6 ? "left" : "center";
}

function getWords(text: string) {
  return text.match(/\S+/g) ?? [];
}

function hasVisibleStickerAccent(stickers: CanvasSpec["stickers"], text: string) {
  const normalizedText = text.toLowerCase();
  return (stickers ?? []).some((sticker) => normalizedText.includes(sticker.word.toLowerCase()));
}

function getWordAnchorKey(word: string) {
  return word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "")
    .replace(/[^a-z0-9'-]/g, "");
}

function getPostShareUrl(postId: string) {
  if (typeof window === "undefined") return `/p/${postId}`;
  return `${window.location.origin}/p/${postId}`;
}

function getTextSafeInsets(canvasHeight: number) {
  return {
    top: Math.max(TEXT_SAFE_TOP_PX, canvasHeight * 0.09),
    bottom: Math.max(TEXT_SAFE_BOTTOM_PX, canvasHeight * 0.17),
  };
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

// Average glyph advance as a fraction of the font size for the heavy sans we
// render reveal words in. Deliberately on the wide side so the predicted width
// is never an under-estimate — the word starts a touch small and the precise
// layout effect grows it to the exact target, rather than ever flashing wider
// than the canvas before the effect runs.
const AVG_GLYPH_WIDTH_EM = 0.62;

let soloMeasureCtx: CanvasRenderingContext2D | null | undefined;

// Best-effort intrinsic width of a single word at a given font size, computed
// synchronously at render time (no DOM, no layout pass). On the client this
// uses a shared 2D-canvas text metric; during SSR — where the real overflow
// flash happens, since layout effects never run there — it falls back to a
// glyph-count estimate so the very first painted frame is already in-bounds.
function estimateWordWidth(word: string, size: number, font: string, weight: number) {
  const trimmed = word.trim();
  if (!trimmed) return 0;
  if (typeof document !== "undefined") {
    if (soloMeasureCtx === undefined) {
      soloMeasureCtx = document.createElement("canvas").getContext("2d");
    }
    if (soloMeasureCtx) {
      soloMeasureCtx.font = `${weight} ${size}px ${font}, system-ui, sans-serif`;
      const measured = soloMeasureCtx.measureText(trimmed).width;
      if (measured > 0) return measured;
    }
  }
  return trimmed.length * size * AVG_GLYPH_WIDTH_EM;
}

// The fit scale a solo reveal word should START at so it already fills (without
// exceeding) the target share of the canvas on the very first paint — before
// the layout effect has a chance to measure and refine. Mirrors the width math
// in the layout effect (target fraction ÷ estimated width), clamped to the same
// solo bounds. The effect then converges to the exact pixel-measured fit.
function estimateSoloRevealFit(
  text: string,
  size: number,
  canvasWidth: number,
  visualScaleGuard: number,
  font: string,
  weight: number,
  // Reveal words are emphasized, so they render EMPHASIS_FONT_SCALE bigger than
  // `size`. Fold that in or the first paint over-sizes the word (and spills past
  // the canvas) until the DOM-measured layout effect — which DOES see the
  // emphasis — claws it back.
  emphasisFactor: number,
) {
  const estWidth =
    estimateWordWidth(text, size, font, weight) * Math.max(visualScaleGuard, 1) * emphasisFactor;
  if (estWidth <= 0 || canvasWidth <= 0) return 1;
  const target = (canvasWidth * SOLO_REVEAL_TARGET_WIDTH_FRACTION) / estWidth;
  return clampNumber(target, SOLO_REVEAL_MIN_FIT, SOLO_REVEAL_MAX_STRETCH);
}

function getMeasuredSoloWordWidth(text: HTMLElement, soloInlineScale: number) {
  const spans = Array.from(text.querySelectorAll("span"));
  const glyphSpan = spans.find((span) => span.querySelector("span") === null);
  const raw = glyphSpan ? glyphSpan.getBoundingClientRect().width : text.scrollWidth;
  return raw / Math.max(soloInlineScale, 0.01);
}

function getMeasuredTextWidth(text: HTMLElement, wrapper: HTMLElement, leftAnchored: boolean) {
  if (!leftAnchored) return text.scrollWidth;

  const wrapperLeft = wrapper.getBoundingClientRect().left;
  const rightEdge = Array.from(text.querySelectorAll("span")).reduce((maxRight, element) => {
    return Math.max(maxRight, element.getBoundingClientRect().right - wrapperLeft);
  }, 0);

  return rightEdge || text.scrollWidth;
}

function normalizeComment(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function limitCommentText(value: string) {
  const clipped = value.slice(0, MAX_COMMENT_CHARS);
  const words = getWords(clipped);
  if (words.length <= MAX_COMMENT_WORDS) return clipped;
  return words.slice(0, MAX_COMMENT_WORDS).join(" ");
}

function getEmphasizedWordIndexes(words: string[]) {
  const poeticIndexes = getSpecialPoeticWordIndexes(words);
  if (poeticIndexes.size > 0) return poeticIndexes;

  const candidates = words
    .map((word, index) => ({
      index,
      score: getWordImportance(word, index, words.length),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const desiredCount = Math.min(2, Math.max(1, Math.ceil(words.length / 4)));
  const selected = candidates.slice(0, desiredCount).map((item) => item.index);
  if (selected.length === 0 && words.length > 0) selected.push(words.length - 1);
  return expandEmphasisToBoundPhrases(words, selected);
}

type EmphasisVariant = (typeof EMPHASIS_VARIANTS)[number];

function getEmphasisVariant(
  text: string,
  word: string,
  index: number,
  allowLuminous: boolean,
): EmphasisVariant {
  const pool: readonly EmphasisVariant[] = allowLuminous
    ? EMPHASIS_VARIANTS
    : NON_LUMINOUS_EMPHASIS_VARIANTS;
  return pool[getStableNumber(`${text}|${word}|${index}`) % pool.length];
}

// Every post is auto-assigned one of these word-entrance "personalities", picked
// stably from its text so replays look identical and the creator never has to
// choose. Only the starting (`hidden`) state and the transition curve differ —
// all of them settle to the exact same neutral resting state, so layout, fit and
// emphasis sizing are unaffected no matter which entrance plays.
const ENTRANCE_STYLES = ["rise", "fall", "pop", "drift", "tilt", "focus"] as const;
const POETIC_ENTRANCE_STYLES = ["poetic-bloom", "poetic-drift"] as const;
type EntranceStyle = (typeof ENTRANCE_STYLES)[number];
type PoeticEntranceStyle = (typeof POETIC_ENTRANCE_STYLES)[number];
type ResolvedEntranceStyle = EntranceStyle | PoeticEntranceStyle;

// Shared resting state — resets every transform any hidden state touches (x, y,
// scale, rotate, blur) so words always land in the same place.
const ENTRANCE_REST: TargetAndTransition = {
  opacity: 1,
  x: 0,
  y: 0,
  scale: 1,
  rotate: 0,
  filter: "blur(0px)",
};

function getEntranceStyle(seed: string, rhythm?: Rhythm): ResolvedEntranceStyle {
  if (rhythm === "poetic") {
    return POETIC_ENTRANCE_STYLES[
      getStableNumber(`poetic-entrance|${seed}`) % POETIC_ENTRANCE_STYLES.length
    ];
  }
  return ENTRANCE_STYLES[getStableNumber(`entrance|${seed}`) % ENTRANCE_STYLES.length];
}

// The starting pose a word springs in from. Emphasized words travel a little
// further / scale a little harder so their arrival reads as the accent it is.
// `dir` alternates per word so the directional styles fan in instead of marching.
function getEntranceHidden(
  style: ResolvedEntranceStyle,
  important: boolean,
  index: number,
): TargetAndTransition {
  const dir = index % 2 === 0 ? -1 : 1;
  switch (style) {
    case "poetic-bloom":
      // A slow focus-and-breath reveal: no spring, no punch, just a soft bloom.
      return {
        opacity: 0,
        y: important ? 14 : 10,
        scale: important ? 1.12 : 1.06,
        filter: "blur(18px)",
      };
    case "poetic-drift":
      // A barely-there lateral drift, like a line settling on paper.
      return {
        opacity: 0,
        x: dir * (important ? 16 : 10),
        y: important ? 12 : 8,
        scale: important ? 1.08 : 1.03,
        filter: "blur(16px)",
      };
    case "fall":
      // Drop down from above and settle.
      return {
        opacity: 0,
        y: important ? -38 : -26,
        scale: important ? 0.72 : 0.9,
        filter: "blur(8px)",
      };
    case "pop":
      // Punch up from tiny with a spring overshoot.
      return { opacity: 0, scale: important ? 0.24 : 0.42, filter: "blur(4px)" };
    case "drift":
      // Fan in from alternating sides.
      return { opacity: 0, x: dir * (important ? 54 : 40), y: 6, filter: "blur(8px)" };
    case "tilt":
      // Swing into place with a small rotation.
      return {
        opacity: 0,
        y: important ? 22 : 15,
        rotate: dir * 9,
        scale: important ? 0.74 : 0.9,
        filter: "blur(7px)",
      };
    case "focus":
      // Cinematic rack-focus: bloom in from slightly oversized + heavy blur.
      return { opacity: 0, scale: important ? 1.5 : 1.2, filter: "blur(16px)" };
    case "rise":
    default:
      // The original: float up from below with a soft blur.
      return {
        opacity: 0,
        y: important ? 34 : 22,
        scale: important ? 0.66 : 0.88,
        filter: "blur(10px)",
      };
  }
}

function getEntranceTransition(
  style: ResolvedEntranceStyle,
  delay: number,
  duration: number,
): Transition {
  if (style === "poetic-bloom" || style === "poetic-drift") {
    return { delay, duration: duration * 1.55, ease: [0.16, 1, 0.3, 1] };
  }
  if (style === "pop") {
    return { delay, type: "spring", stiffness: 380, damping: 17, mass: 0.7 };
  }
  if (style === "tilt") {
    return { delay, type: "spring", stiffness: 300, damping: 19, mass: 0.8 };
  }
  // Slower, softer easing for the blur-heavy reveals so they breathe rather than snap.
  const stretch = style === "focus" ? 1.12 : style === "drift" ? 1.05 : 1;
  return { delay, duration: duration * stretch, ease: [0.22, 1, 0.36, 1] };
}

// True for dim/dark colors where a glow or halo would look muddy. Uses HSV value
// (the brightest channel) so vibrant pink/blue/purple still count as bright.
function isDimEmphasisColor(color: string) {
  const hex = color.trim().replace(/^#/, "");
  const full = hex.length === 3 ? hex.replace(/(.)/g, "$1$1") : hex;
  if (full.length !== 6) return false;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return Math.max(r, g, b) / 255 < 0.42;
}

function getEmphasisTextShadow(variant: EmphasisVariant | null) {
  if (variant === "color") {
    return "0 4px 40px rgba(0,0,0,0.45)";
  }
  if (variant === "sweep") {
    return "0 0 22px rgba(255,255,255,0.3), 0 5px 36px rgba(0,0,0,0.55)";
  }
  if (variant === "halo") {
    return "0 4px 40px rgba(0,0,0,0.45)";
  }
  if (variant === "glow") {
    return "0 0 0.14em var(--kinetic-aura-color, #FFBE0B), 0 0 0.4em var(--kinetic-aura-color, #FFBE0B), 0 5px 30px rgba(0,0,0,0.5)";
  }
  if (variant === "frame") {
    return "0 2px 16px rgba(0,0,0,0.5)";
  }
  return "0 0 22px rgba(255,255,255,0.35), 0 5px 36px rgba(0,0,0,0.55)";
}

// halo and frame are driven entirely by their CSS classes (kinetic-emph-halo /
// kinetic-emph-frame); only the transform/filter variants animate inline.
function getEmphasisInnerAnimation(variant: EmphasisVariant | null, staticRender: boolean) {
  if (staticRender || !variant) return undefined;
  if (variant === "jiggle") return "kinetic-emphasis-jiggle 0.58s ease-in-out 0.08s 2";
  if (variant === "pulse") return "kinetic-emphasis-pulse 1.35s ease-in-out infinite";
  if (variant === "glow") return "kinetic-emphasis-glow 1.6s ease-in-out infinite";
  return undefined;
}

function getAuraColor(textColor: string) {
  return isWhiteLikeColor(textColor) ? "#FFBE0B" : "currentColor";
}

function isWhiteLikeColor(color: string) {
  const normalized = color.trim().toLowerCase();
  return normalized === "white" || normalized === "#fff" || normalized === "#ffffff";
}

function getWordImportance(word: string, index: number, total: number) {
  const cleaned = word.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
  if (!cleaned || STOP_WORDS.has(cleaned)) return 0;

  let score = 0;
  // A standalone number is the punchline of a clue sentence — a count, a
  // quantity, the fact the reader is meant to register. Always let the digits
  // win the emphasis (e.g. "Cả từ gồm 9 chữ cái." highlights the 9, never the
  // trailing noun), so it outscores every other bonus combined.
  if (/^\d+$/.test(cleaned)) score += 12;
  if (EMPHASIS_WORDS.has(cleaned)) score += 4;
  if (cleaned.length >= 8) score += 3;
  else if (cleaned.length >= 6) score += 2;
  if (index === total - 1 && cleaned.length > 3) score += 2;
  if (word === word.toUpperCase() && /[A-Z]/.test(word)) score += 2;
  return score;
}

const COMMON_SECOND_LEVEL_SUFFIXES = new Set([
  "ac.uk",
  "co.jp",
  "co.kr",
  "co.nz",
  "co.uk",
  "com.au",
  "com.br",
  "com.mx",
  "com.sg",
  "com.vn",
  "net.au",
  "org.au",
  "org.uk",
]);

function getArticlePreview(spec: CanvasSpec, media: string[]): CanvasLinkPreview | null {
  if (spec.link?.url) {
    return {
      ...spec.link,
      host: getMainDomainFromUrl(spec.link.url, spec.link.host),
    };
  }
  const url = media[0];
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    const title = spec.text.replace(/\s+/g, " ").trim() || "Linked article";
    return {
      url: parsed.toString(),
      host: getMainDomain(parsed.hostname),
      title: title.length > 72 ? `${title.slice(0, 69).trim()}...` : title,
    };
  } catch {
    return null;
  }
}

function getMainDomainFromUrl(url: string, fallbackHost = "") {
  try {
    return getMainDomain(new URL(url).hostname);
  } catch {
    return getMainDomain(fallbackHost);
  }
}

function getMainDomain(hostname: string) {
  const host = hostname
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0]
    .replace(/\.$/, "")
    .replace(/^www\./, "");
  if (!host || host === "localhost" || /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)) return host;

  const labels = host.split(".").filter(Boolean);
  if (labels.length <= 2) return host;

  const secondLevelSuffix = labels.slice(-2).join(".");
  if (COMMON_SECOND_LEVEL_SUFFIXES.has(secondLevelSuffix) && labels.length >= 3) {
    return labels.slice(-3).join(".");
  }

  return labels.slice(-2).join(".");
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "so",
  "the",
  "to",
  "you",
  "your",
]);

const EMPHASIS_WORDS = new Set([
  "archive",
  "breathe",
  "count",
  "draft",
  "drafts",
  "fade",
  "feeling",
  "first",
  "frame",
  "glowing",
  "honest",
  "idea",
  "important",
  "landing",
  "louder",
  "memory",
  "motion",
  "pause",
  "proof",
  "protect",
  "replay",
  "rhythm",
  "sentence",
  "spark",
  "surprise",
  "timing",
  "work",
]);

function getCommentLabel(chipId: string) {
  const chip = COMMENT_CHIPS.find((item) => item.id === chipId);
  if (chip) return `${chip.emoji} ${chip.label}`;
  return normalizeComment(chipId.replace(/_/g, " ")) || "comment";
}

function formatShortDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "now";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatPostDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "posted";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

// Placeholder collections
const PLACEHOLDER_FOLDERS = [
  { id: "favorites", label: "Favorites", emoji: "\u2764\ufe0f" },
  { id: "inspiration", label: "Inspiration", emoji: "\u2728" },
  { id: "read-later", label: "Read Later", emoji: "\ud83d\udcda" },
  { id: "design", label: "Design", emoji: "\ud83c\udfa8" },
  { id: "code", label: "Code", emoji: "\ud83d\udcbb" },
  { id: "research", label: "Research", emoji: "\ud83d\udd2c" },
  { id: "archive", label: "Archive", emoji: "\ud83d\udcc1" },
  { id: "tutorials", label: "Tutorials", emoji: "\ud83c\udf93" },
  { id: "entertainment", label: "Fun", emoji: "\ud83c\udfad" },
];

const PLACEHOLDER_TAGS = [
  "Motivational",
  "Technical",
  "Creative",
  "Educational",
  "Entertaining",
  "News",
  "Lifestyle",
  "Tutorial",
  "Deep Dive",
  "Quick Tip",
];

function CollectionPicker({
  selectedFolders,
  selectedTags,
  onToggleFolder,
  onToggleTag,
  onSave,
  onClose,
}: {
  selectedFolders: Set<string>;
  selectedTags: Set<string>;
  onToggleFolder: (id: string) => void;
  onToggleTag: (tag: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      className="absolute inset-0 z-50"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-[136px] right-6 w-[min(304px,calc(100%-5.5rem))] origin-[78%_100%]"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-[62px] right-10 h-[62px] w-5"
        >
          <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-[#171717] via-[#171717]/85 to-transparent shadow-[0_0_16px_rgba(0,0,0,0.4)]" />
          <span className="absolute bottom-0 left-1/2 size-3 -translate-x-1/2 rotate-45 bg-[#171717] shadow-[6px_-6px_22px_rgba(0,0,0,0.28)] ring-1 ring-white/10" />
        </span>
        <div className="relative flex max-h-[min(58dvh,430px)] flex-col overflow-hidden rounded-2xl bg-[#171717]/95 shadow-[0_18px_55px_rgba(0,0,0,0.58)] ring-1 ring-white/10 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <h3 className="text-sm font-black text-white">Save</h3>
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/45">
                collections · tags
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid size-8 place-items-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20"
              aria-label="Close collection picker"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3">
            <p className="mb-2 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-white/45">
              Folders
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {PLACEHOLDER_FOLDERS.map((folder) => {
                const isSelected = selectedFolders.has(folder.id);
                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => onToggleFolder(folder.id)}
                    className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 transition active:scale-95 ${
                      isSelected
                        ? "border-white/[0.45] bg-white/[0.16] shadow-[0_0_16px_rgba(255,255,255,0.08)]"
                        : "border-white/10 bg-white/[0.06] hover:bg-white/10"
                    }`}
                  >
                    <span className="text-base">{folder.emoji}</span>
                    <span
                      className={`max-w-full truncate text-[10px] font-bold leading-none ${
                        isSelected ? "text-white" : "text-white/[0.62]"
                      }`}
                    >
                      {folder.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="mb-2 mt-4 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-white/45">
              Tags
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PLACEHOLDER_TAGS.map((tag) => {
                const isSelected = selectedTags.has(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onToggleTag(tag)}
                    className={`rounded-full border px-2.5 py-1.5 text-[11px] font-bold transition active:scale-95 ${
                      isSelected
                        ? "border-white/[0.45] bg-white/[0.22] text-white"
                        : "border-white/10 bg-white/[0.06] text-white/55 hover:bg-white/10 hover:text-white/75"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-white/10 px-3 py-3">
            <button
              type="button"
              onClick={onSave}
              disabled={selectedFolders.size === 0 && selectedTags.size === 0}
              className="w-full rounded-full bg-white py-2.5 text-sm font-black text-black transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30"
            >
              save
              {selectedFolders.size + selectedTags.size > 0
                ? ` ${selectedFolders.size + selectedTags.size}`
                : ""}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
