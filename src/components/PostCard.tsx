import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
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
import speechBubbleReferenceUrl from "@/assets/speech-bubble-reference.svg?url";
import {
  ArrowUpRight,
  Bell,
  FastForward,
  Heart,
  Home,
  Info,
  Link2,
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
import {
  COMMENT_CHIPS,
  SAFE_CANVAS_BACKGROUND,
  getCanvasEmphasisColor,
  getCanvasEmphasisWordColor,
  getCanvasTextColor,
  isTooDarkCanvasBackground,
  isUsableCanvasBackground,
  parseCanvas,
  resolveCanvasBackground,
  type CanvasLinkPreview,
  type CanvasSpec,
  type Rhythm,
  type Tempo,
} from "@/lib/canvas";
import {
  getTextPageWordLimit,
  getVietnameseWordLines,
  isLikelyVietnameseText,
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
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const SPEECH_BUBBLE_MASK_IMAGE = `url("${speechBubbleReferenceUrl}")`;
const SPEECH_BUBBLE_MASK_STYLE = {
  WebkitMaskImage: SPEECH_BUBBLE_MASK_IMAGE,
  maskImage: SPEECH_BUBBLE_MASK_IMAGE,
  WebkitMaskSize: "100% 100%",
  maskSize: "100% 100%",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
} as const;

// Outline speech bubble (same shape as the comment canvas) so it matches the
// stroked Plus / Heart / Share icons in the arc plate instead of a solid fill.
function CommentBubbleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="20 45 242 253"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={18}
      strokeLinejoin="round"
      aria-hidden
    >
      <g transform="translate(262 0) rotate(90)">
        <path d="M82 26H262C282 26 298 43 298 64V163C298 184 282 201 261 201H153C148 216 135 227 114 235C105 238 96 241 88 242C99 234 104 221 103 201H82C61 201 45 184 45 163V64C45 43 61 26 82 26Z" />
      </g>
    </svg>
  );
}

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
  const [customComment, setCustomComment] = useState("");
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
  const staticCanvasBackground = getResolvedPostBackground(post);
  const slidingCanvasBackground = useMemo(
    () => getSlidingCanvasBackground(spec, staticCanvasBackground ?? null, backgroundShiftPage),
    [backgroundShiftPage, spec, staticCanvasBackground],
  );
  const hasTransitionBackground = !!slidingCanvasBackground;
  const activeStory = commentStories[storyIndex] ?? null;
  const storyPages = useMemo(
    () => (activeStory ? getCommentStoryPages(activeStory.text, storyFastMode) : []),
    [activeStory, storyFastMode],
  );
  const storyPageText = storyPages[storyPage] ?? storyPages[0] ?? "";
  const activeCommentLabel = activeComment ? getCommentLabel(activeComment.chip) : "";
  const activeCommentAuthor = activeComment ? profilesById.get(activeComment.user_id) : undefined;
  const showingFlyingComment =
    !isPaused && !!activeComment && shouldFloatComment(activeCommentLabel);

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
    const timer = window.setTimeout(
      () => {
        // Rule: slideshow media advances only with text pages, never mid-sentence.
        const nextPage = (textPage + 1) % textPages.length;
        setTextPage(nextPage);
        setBackgroundShiftPage((page) => page + 1);
        setPageRevealed(false);
        if (post.post_type === "slideshow" && media.length > 1) {
          setSlide(nextPage % media.length);
        }
        setPlayKey((key) => key + 1);
      },
      getPageDuration(currentText, spec.tempo),
    );
    return () => window.clearTimeout(timer);
  }, [
    currentText,
    isPaused,
    isVisible,
    media.length,
    pageRevealed,
    post.id,
    post.post_type,
    spec.tempo,
    textPage,
    textPages.length,
  ]);

  useEffect(() => {
    if (isPaused || !isVisible || storyOpen) {
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
  }, [commentFlowKey, floatingComments, isPaused, isVisible, storyOpen]);

  useEffect(() => {
    if (!storyOpen) return;
    setStoryPage(0);
    setStoryPlayKey((key) => key + 1);
  }, [storyFastMode, storyIndex, storyOpen]);

  useEffect(() => {
    if (!storyOpen || !activeStory || storyPages.length === 0 || commentStories.length === 0) {
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
    storyOpen,
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
    setStoryOpen(true);
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
        className="relative h-full w-full overflow-hidden bg-black sm:aspect-[9/16] sm:h-[min(90dvh,764px)] sm:w-auto sm:shadow-[0_24px_90px_rgba(0,0,0,0.45)] sm:ring-1 sm:ring-white/10"
        onClick={handleCanvasTap}
      >
        {slidingCanvasBackground ? (
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
        {hasTransitionBackground && (
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
        {post.post_type === "image" && media[0] && (
          <img src={media[0]} alt="" className="absolute inset-0 size-full object-cover" />
        )}
        {post.post_type === "video" && media[0] && (
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
        {post.post_type === "slideshow" && media[slide] && (
          <AnimatePresence mode="wait">
            <motion.img
              key={slide}
              src={media[slide]}
              alt=""
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="absolute inset-0 size-full object-cover"
            />
          </AnimatePresence>
        )}

        {post.post_type !== "text" && (
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />
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
                entranceSeed={spec.text}
              />
            )}
          </motion.div>
        </AnimatePresence>

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
                />
              ),
            )}
          </div>
        )}

        {textPages.length > 1 && (
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

        {author && (
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

        {commentStories.length > 0 && !storyOpen && (
          <CommentStoryStack
            stories={commentStories}
            onOpen={(event) => {
              event.stopPropagation();
              openCommentStories();
            }}
          />
        )}

        <motion.button
          type="button"
          whileTap={{ scale: 0.88, backgroundColor: "rgba(255,255,255,0.12)" }}
          transition={{ type: "spring", stiffness: 400, damping: 24 }}
          onClick={(e) => {
            e.stopPropagation();
            setShowChips(false);
            setActionMenuOpen((open) => !open);
          }}
          className="absolute right-3 top-4 z-30 grid size-10 place-items-center rounded-full bg-black/40 text-white shadow-[0_12px_30px_rgba(0,0,0,0.3)] ring-1 ring-white/15 backdrop-blur"
          aria-label="More choices"
          aria-expanded={actionMenuOpen}
        >
          <MoreHorizontal className="size-5" />
        </motion.button>

        <AnimatePresence mode="wait">
          {actionMenuOpen ? (
            <PostMenuRail key="menu" />
          ) : (
            <motion.div
              key="actions"
              initial={{ opacity: 0, x: 36 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 36 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="absolute bottom-36 right-0 z-30 flex w-[72px] translate-x-[26px] flex-col overflow-hidden rounded-l-[50%] bg-black/65 pr-[24px] shadow-[0_16px_40px_rgba(0,0,0,0.45)] ring-1 ring-white/10 backdrop-blur-xl"
            >
              {[1, 2, 3].map((line) => (
                <span
                  key={line}
                  aria-hidden
                  className="pointer-events-none absolute left-0 right-[24px] z-0 h-px bg-white/15"
                  style={{ top: `${line * 3.5}rem` }}
                />
              ))}
              <motion.div
                className="relative z-10 h-14 w-full rounded-l-full"
                whileTap={{ ...ARC_BUTTON_TAP, backgroundColor: "rgba(255,255,255,0.1)" }}
                transition={ARC_BUTTON_TAP_TRANSITION}
              >
                <Link
                  to="/create"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Create"
                  className="grid h-full w-full place-items-center pl-3 pt-3 text-white [filter:drop-shadow(0_1px_3px_rgba(0,0,0,0.7))]"
                >
                  <Plus className="size-6" strokeWidth={2.5} />
                </Link>
              </motion.div>

              <motion.button
                type="button"
                whileTap={{ ...ARC_BUTTON_TAP, backgroundColor: "rgba(255,255,255,0.1)" }}
                transition={ARC_BUTTON_TAP_TRANSITION}
                onPointerDown={handleLikePointerDown}
                onPointerUp={handleLikePointerUp}
                onPointerCancel={handleLikePointerCancel}
                onContextMenu={(e) => e.preventDefault()}
                aria-label="Like (hold to save to collection)"
                aria-pressed={liked}
                className="relative z-10 grid h-14 w-full touch-none place-items-center pl-3 [filter:drop-shadow(0_1px_3px_rgba(0,0,0,0.7))]"
              >
                <span className="relative grid size-8 -translate-x-1 place-items-center">
                  <Heart
                    className={`absolute inset-0 size-8 transition ${
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

              <motion.button
                type="button"
                whileTap={{ ...ARC_BUTTON_TAP, backgroundColor: "rgba(255,255,255,0.1)" }}
                transition={ARC_BUTTON_TAP_TRANSITION}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowChips((s) => !s);
                }}
                aria-label="Comment"
                className="relative z-10 grid h-14 w-full place-items-center [filter:drop-shadow(0_1px_3px_rgba(0,0,0,0.7))]"
              >
                <span className="relative grid size-7 place-items-center">
                  <CommentBubbleIcon className="absolute inset-0 size-7 text-white" />
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

              <motion.button
                type="button"
                whileTap={{ ...ARC_BUTTON_TAP, backgroundColor: "rgba(255,255,255,0.1)" }}
                transition={ARC_BUTTON_TAP_TRANSITION}
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    if (navigator.share) {
                      await navigator.share({
                        title: author ? `${author.display_name} on Kinetic` : "Kinetic status",
                        url: postUrl,
                      });
                    } else {
                      await navigator.clipboard.writeText(postUrl);
                      toast.success("post link copied");
                    }
                  } catch (error) {
                    if ((error as Error).name !== "AbortError") toast.error("could not share post");
                  }
                }}
                aria-label="Share"
                className="relative z-10 grid h-14 w-full place-items-center pb-3 pl-3 text-white [filter:drop-shadow(0_1px_3px_rgba(0,0,0,0.7))]"
              >
                <Share2 className="size-5" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showCollectionPicker && (
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

        <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 flex w-full -translate-x-1/2 flex-col items-center gap-1 overflow-hidden">
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
                      getCommentFlightDuration(getFloatingCommentLabel(activeCommentLabel)) / 1000,
                    ease: "linear",
                  },
                }}
                // Dim the bottom-left info only while this chip is actually over
                // it. State flips just twice per flight (enter/exit the band).
                onUpdate={(latest) => {
                  const x = typeof latest.x === "number" ? latest.x : parseFloat(String(latest.x));
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

        <AnimatePresence>
          {isPaused && !storyOpen && !showCollectionPicker && (
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
          {storyOpen && activeStory && (
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
          {showChips && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="absolute inset-x-0 bottom-16 z-30 glass mx-3 rounded-2xl p-3"
              onClick={(e) => e.stopPropagation()}
            >
              <form
                className="mb-3 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitComment(customComment);
                }}
              >
                <input
                  value={customComment}
                  onChange={(event) => setCustomComment(limitCommentText(event.target.value))}
                  placeholder="add an animated comment"
                  className="min-w-0 flex-1 rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-white/40 focus:ring-primary/70"
                />
                <button
                  type="submit"
                  disabled={!normalizeComment(customComment)}
                  className="rounded-xl bg-white px-3 text-xs font-bold text-black transition disabled:opacity-40"
                >
                  send
                </button>
              </form>
              <div className="mb-2 flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <span>quick react</span>
                <span>
                  {getWords(customComment).length}/{MAX_COMMENT_WORDS}
                </span>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {COMMENT_CHIPS.map((chip) => (
                  <button
                    key={chip.id}
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
      </article>
    </section>
  );
}

function PostMenuRail() {
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
      <RailMenuLink to="/feed" label="feed" icon={<Home className="size-4" />} />
      <RailMenuLink to="/discover" label="discover" icon={<Search className="size-4" />} />
      <RailMenuLink to="/notifications" label="activity" icon={<Bell className="size-4" />} />
      <RailMenuLink to="/me" label="profile" icon={<User className="size-4" />} />
      <RailMenuLink to="/settings" label="settings" icon={<Settings className="size-4" />} />
      <RailMenuLink to="/about" label="about" icon={<Info className="size-4" />} />
    </motion.div>
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

function CommentStoryStack({
  stories,
  onOpen,
}: {
  stories: CommentStory[];
  onOpen: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
  const preview = stories.slice(-3);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="absolute bottom-4 right-3 z-30 h-[88px] w-[82px]"
      aria-label="Open animated comments"
    >
      {preview.map((story, index) => {
        const offset = preview.length - 1 - index;
        const background = getCommentStoryGradient(story.index);
        return (
          <span
            key={story.id}
            className="absolute bottom-0 right-0 h-[86px] w-[68px] text-white"
            style={{
              zIndex: index + 1,
              transform: `translate(${-offset * 7}px, ${-offset * 6}px) rotate(${-offset * 3}deg)`,
            }}
          >
            <span
              aria-hidden
              className="absolute inset-0"
              style={{
                background,
                ...SPEECH_BUBBLE_MASK_STYLE,
                filter: "drop-shadow(0 12px 30px rgba(0,0,0,0.45))",
              }}
            />
            <span
              aria-hidden
              className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/45"
              style={SPEECH_BUBBLE_MASK_STYLE}
            />
            <span className="absolute inset-y-0 left-[10px] right-0 overflow-hidden rounded-[14px]">
              <span className="absolute inset-x-1.5 top-3 flex gap-0.5">
                <span className="h-0.5 flex-1 rounded-full bg-white/80" />
                <span className="h-0.5 flex-1 rounded-full bg-white/30" />
              </span>
              <span className="absolute left-2 top-5 flex w-[78%] gap-0.5">
                <span className="h-0.5 flex-[3] rounded-full bg-white/50" />
                <span className="h-0.5 flex-1 rounded-full bg-white/25" />
              </span>
              <span className="absolute inset-x-2 bottom-3 flex flex-col gap-[3px]">
                <span className="h-0.5 w-[85%] rounded-full bg-white/40" />
                <span className="h-0.5 w-[65%] rounded-full bg-white/30" />
                <span className="h-0.5 w-[75%] rounded-full bg-white/25" />
              </span>
            </span>
          </span>
        );
      })}
      <span className="absolute -right-1 -top-1 z-10 grid size-6 place-items-center rounded-full bg-white text-[10px] font-black text-black ring-2 ring-black">
        {stories.length}
      </span>
    </button>
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
  const words = getWords(displayText);
  const emphasized = getEmphasizedWordIndexes(words);
  const textColor = getCanvasTextColor({ color: "#ffffff" }, background);
  const emphasisColor = getCanvasEmphasisColor({ color: textColor }, background);

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
    <div className="absolute inset-x-6 top-[20%] bottom-[18%] z-10 grid place-items-center">
      <motion.div
        key={playKey}
        className="flex flex-wrap items-center justify-center text-center font-black leading-[0.9] drop-shadow-[0_8px_34px_rgba(0,0,0,0.55)]"
        style={{
          columnGap: "0.25em",
          rowGap: "0.1em",
          fontSize: "clamp(2rem, 6vh, 3.5rem)",
        }}
      >
        {words.map((word, index) => {
          const important = emphasized.has(index);
          return (
            <motion.span
              key={`${word}-${index}`}
              initial={{
                opacity: 0,
                y: important ? 34 : 22,
                scale: important ? 0.74 : 0.9,
                filter: "blur(10px)",
              }}
              animate={{
                opacity: 1,
                y: 0,
                scale: important ? 1.1 : 1,
                filter: "blur(0px)",
              }}
              transition={{
                delay: index * 0.14,
                duration: important ? 0.58 : 0.46,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="inline-flex"
              style={{
                color: important ? emphasisColor : textColor,
              }}
            >
              {word}
            </motion.span>
          );
        })}
      </motion.div>
    </div>
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

  for (const unit of units) {
    if (currentWords.length > 0 && currentWeight + unit.weight > targetWordsPerPage) {
      chunks.push(currentWords.join(" "));
      currentWords = [];
      currentWeight = 0;
    }

    currentWords.push(...unit.words);
    currentWeight += unit.weight;
  }

  if (currentWords.length > 0) chunks.push(currentWords.join(" "));
  // The first chunk heads the sentence (deliberate); later chunks are overflow
  // continuations that may merge back if they end up too short.
  return chunks.map((text, index) => ({ text, mergeable: index > 0 }));
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

function getPageDuration(text: string, tempo: Tempo) {
  const wordCount = getWords(text).length;
  const base = Math.max(3200, Math.min(5200, 1900 + wordCount * 430));
  return base * tempoConfig[tempo].pageMultiplier;
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
  // Stable seed (the full post text) so every page of one post shares the same
  // auto-picked entrance personality. Falls back to the page text when absent.
  entranceSeed?: string;
}) {
  const words = getWords(spec.text);
  const entranceStyle = getEntranceStyle(entranceSeed ?? spec.text);
  const isVietnamese = isLikelyVietnameseText(spec.text);
  const vietnameseLines = isVietnamese ? getVietnameseWordLines(words) : [];
  const emphasized = getEmphasizedWordIndexes(words);
  const layoutMode = getKineticTextLayoutMode(spec.text, isVietnamese, words.length, emphasized);
  const leftAnchoredText = layoutMode !== "center";
  const spotlightEmphasis = layoutMode === "left-spotlight";
  const tempo = tempoConfig[spec.tempo];
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const [soloInlineScale, setSoloInlineScale] = useState(1);
  const [safeCenterY, setSafeCenterY] = useState(spec.y);
  const staticRender = revealed || measure;
  const fontSize = spec.size * (disableFit ? 1 : fitScale);
  const textColor = getCanvasTextColor(spec, background);
  const emphasisColor = getCanvasEmphasisColor({ ...spec, color: textColor }, background);
  const visualScaleGuard = Math.max(
    emphasized.size > 0 ? EMPHASIS_SCALE_FIT_GUARD : 1,
    isVietnamese ? VIETNAMESE_SCALE_FIT_GUARD : 1,
  );

  useIsomorphicLayoutEffect(() => {
    setFitScale(1);
    setSoloInlineScale(1);
    setSafeCenterY(spec.y);
  }, [
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
    const measuredWidth = getMeasuredTextWidth(text, wrapper, leftAnchoredText);
    const widthRatio = wrapperWidth / Math.max(measuredWidth * visualScaleGuard, 1);
    const heightRatio = maxHeight / Math.max(text.scrollHeight, 1);
    // A single word cannot wrap, so the usual immersive minimums must not block
    // it from shrinking enough to fit. For reveal words, keep the letters tall
    // and condense the word horizontally only when that is needed to stay inside
    // the canvas bounds.
    const isSolo = words.length <= 1;
    const finalSizeFloor = Math.min(1, MIN_FONT_SIZE / Math.max(spec.size, 1));
    const floor = isSolo
      ? SOLO_TEXT_MIN_FIT
      : Math.max(isVietnamese ? MIN_TEXT_FIT_SCALE : MIN_ENGLISH_TEXT_FIT_SCALE, finalSizeFloor);
    const widthFit = Math.min(1, fitScale * widthRatio * 0.98);
    const heightFit = Math.min(1, fitScale * heightRatio * 0.98);
    const nextFit = isSolo
      ? Math.max(floor, Math.min(1, Math.max(widthFit, SOLO_REVEAL_MIN_FIT), heightFit))
      : Math.max(floor, Math.min(1, widthFit, heightFit));
    const nextSoloInlineScale = isSolo ? Math.min(1, widthFit / Math.max(nextFit, 0.01)) : 1;
    const textHeight = text.scrollHeight;
    const requestedCenter = (canvasHeight * spec.y) / 100;
    const halfText = Math.min(textHeight / 2, safeHeight / 2);
    const minCenter = safeInsets.top + halfText;
    const maxCenter = canvasHeight - safeInsets.bottom - halfText;
    const nextCenterY =
      minCenter <= maxCenter
        ? (clampNumber(requestedCenter, minCenter, maxCenter) / canvasHeight) * 100
        : ((safeInsets.top + safeHeight / 2) / canvasHeight) * 100;

    if (!disableFit && nextFit < fitScale - 0.01) {
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
    const entranceDuration = staticRender
      ? 0.01
      : important
        ? tempo.wordDuration * 1.22
        : tempo.wordDuration;
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
    const isSoloRevealWord = words.length <= 1;
    return (
      <motion.span
        key={`${word}-${index}`}
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
        width: TEXT_SAFE_MAX_WIDTH,
        maxWidth: TEXT_SAFE_MAX_WIDTH,
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
          textShadow: "0 4px 40px rgba(0,0,0,0.45)",
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
  return new Set(selected);
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
type EntranceStyle = (typeof ENTRANCE_STYLES)[number];

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

function getEntranceStyle(seed: string): EntranceStyle {
  return ENTRANCE_STYLES[getStableNumber(`entrance|${seed}`) % ENTRANCE_STYLES.length];
}

// The starting pose a word springs in from. Emphasized words travel a little
// further / scale a little harder so their arrival reads as the accent it is.
// `dir` alternates per word so the directional styles fan in instead of marching.
function getEntranceHidden(
  style: EntranceStyle,
  important: boolean,
  index: number,
): TargetAndTransition {
  const dir = index % 2 === 0 ? -1 : 1;
  switch (style) {
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

function getEntranceTransition(style: EntranceStyle, delay: number, duration: number): Transition {
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
  // sweep clips the fill to a moving gradient, so a text-shadow wouldn't show
  // through; legibility comes from the drop-shadow filter in its CSS class.
  if (variant === "sweep") {
    return "none";
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
        className="absolute bottom-[190px] left-[46%] w-[min(304px,calc(100%-5.5rem))] origin-[88%_75%]"
        style={{ x: "-50%" }}
      >
        <span
          aria-hidden
          className="absolute -right-2 bottom-[88px] size-4 rotate-45 bg-[#171717] shadow-[6px_-6px_22px_rgba(0,0,0,0.28)] ring-1 ring-white/10"
        />
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
