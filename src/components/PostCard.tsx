import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import {
  ArrowUpRight,
  Bell,
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
import {
  COMMENT_CHIPS,
  parseCanvas,
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
const MIN_TEXT_FIT_SCALE = 0.08;
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

// Single speech-bubble outline for comment-story stack thumbnails. Drawn in a
// 90x170 viewBox; the left 12 units form the curved tail so it matches the
// full-screen comment player language.
const BUBBLE_PATH_D =
  "M 26 0 H 74 C 83 0 90 7 90 16 V 154 C 90 163 83 170 74 170 H 26 C 17 170 12 163 12 154 V 58 C 8 50 3 38 1 31 C 0 26 4 24 7 29 C 10 34 12 39 12 45 V 16 C 12 7 17 0 26 0 Z";
const BUBBLE_MASK_URL = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 90 170' preserveAspectRatio='none'><path d='${BUBBLE_PATH_D}' fill='black'/></svg>`,
)}")`;
const BUBBLE_MASK_STYLE = {
  WebkitMaskImage: BUBBLE_MASK_URL,
  maskImage: BUBBLE_MASK_URL,
  WebkitMaskSize: "100% 100%",
  maskSize: "100% 100%",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
} as const;

// Full comment player shape. Body is the existing 9:16 card; the visible tail
// keeps the previous -22px left offset and 18%-34% vertical span, but the whole
// bubble is now a single masked silhouette with a rounded upward arc.
const STORY_PLAYER_BUBBLE_PATH_D =
  "M 52 0 H 352 C 368 0 382 14 382 30 V 610 C 382 626 368 640 352 640 H 52 C 36 640 22 626 22 610 V 218 C 16 199 8 158 2 126 C 0 116 4 111 10 119 C 17 128 21 143 22 156 V 30 C 22 14 36 0 52 0 Z";
const STORY_PLAYER_BUBBLE_MASK_URL = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 382 640' preserveAspectRatio='none'><path d='${STORY_PLAYER_BUBBLE_PATH_D}' fill='black'/></svg>`,
)}")`;
const STORY_PLAYER_BUBBLE_MASK_STYLE = {
  WebkitMaskImage: STORY_PLAYER_BUBBLE_MASK_URL,
  maskImage: STORY_PLAYER_BUBBLE_MASK_URL,
  WebkitMaskSize: "100% 100%",
  maskSize: "100% 100%",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
} as const;

const FLOATING_COMMENT_MAX_WORDS = 3;
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
  const [showChips, setShowChips] = useState(false);
  const [customComment, setCustomComment] = useState("");
  const [activeComment, setActiveComment] = useState<FlowComment | null>(null);
  const [storyOpen, setStoryOpen] = useState(false);
  const [storyIndex, setStoryIndex] = useState(0);
  const [storyPage, setStoryPage] = useState(0);
  const [storyPlayKey, setStoryPlayKey] = useState(0);
  const [storyFastMode, setStoryFastMode] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pageRevealed, setPageRevealed] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(390);
  const flyId = useRef(0);
  const localCommentId = useRef(0);
  const manualCommentHoldUntil = useRef(0);
  const canvasRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const media = post.media_urls ?? [];
  const articlePreview = getArticlePreview(spec, media);
  const commentLaneWidth = Math.max(180, canvasWidth - 96);
  const commentMaxWidth = Math.min(commentLaneWidth * 0.78, 290);
  const commentStartX = commentLaneWidth + 16;
  const commentEndX = -(commentMaxWidth + 24);
  const currentText = textPages[textPage] ?? textPages[0] ?? "";
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
  const postHashtags = useMemo(
    () => getPostHashtags(spec.text, post.post_type),
    [post.post_type, spec.text],
  );
  const viewCount = useMemo(
    () => getPostViewCount(post, likes, chronologicalComments.length),
    [chronologicalComments.length, likes, post],
  );
  const displaySpec: CanvasSpec = {
    ...spec,
    text: currentText,
    size: getPageTextSize(spec.size, currentText),
    entrance: "fade",
  };

  useEffect(() => {
    setTextPage(0);
    setSlide(0);
    setPlayKey(0);
    setIsPaused(false);
    setStoryOpen(false);
    setStoryIndex(0);
    setStoryPage(0);
    setStoryFastMode(false);
    setActionMenuOpen(false);
    setPageRevealed(false);
    setLocalComments([]);
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
    if (isPaused) return;
    if (pageRevealed) return;
    if (textPages.length < 2) return;
    const timer = window.setTimeout(
      () => {
        // Rule: slideshow media advances only with text pages, never mid-sentence.
        const nextPage = (textPage + 1) % textPages.length;
        setTextPage(nextPage);
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
    media.length,
    pageRevealed,
    post.id,
    post.post_type,
    spec.tempo,
    textPage,
    textPages.length,
  ]);

  useEffect(() => {
    if (isPaused || storyOpen) {
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
  }, [commentFlowKey, floatingComments, isPaused, storyOpen]);

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
    if (isPaused) {
      video.pause();
      return;
    }
    video.play().catch(() => undefined);
  }, [isPaused, post.post_type]);

  function showNextTextPage(revealed: boolean) {
    if (textPages.length < 2) {
      setPageRevealed(revealed);
      setPlayKey((key) => key + 1);
      return;
    }

    const nextPage = (textPage + 1) % textPages.length;
    setTextPage(nextPage);
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
    <section className="relative flex h-[100dvh] w-full snap-start items-center justify-center overflow-hidden bg-background">
      <article
        ref={canvasRef}
        className="relative h-full w-full overflow-hidden bg-black sm:aspect-[9/16] sm:h-[min(90dvh,764px)] sm:w-auto sm:rounded-[28px] sm:shadow-[0_24px_90px_rgba(0,0,0,0.45)] sm:ring-1 sm:ring-white/10"
        style={{
          background: post.bg_gradient ?? "#000",
        }}
        onClick={handleCanvasTap}
      >
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
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
            className="absolute inset-0"
          >
            <WordSequenceText
              spec={displaySpec}
              playKey={playKey}
              paused={isPaused}
              revealed={pageRevealed}
              canvasWidth={canvasWidth}
            />
          </motion.div>
        </AnimatePresence>

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
            profilesById={profilesById}
            onOpen={(event) => {
              event.stopPropagation();
              openCommentStories();
            }}
          />
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowChips(false);
            setActionMenuOpen((open) => !open);
          }}
          className="absolute right-3 top-4 z-30 grid size-10 place-items-center rounded-full bg-black/40 text-white shadow-[0_12px_30px_rgba(0,0,0,0.3)] ring-1 ring-white/15 backdrop-blur transition active:scale-95"
          aria-label="More choices"
          aria-expanded={actionMenuOpen}
        >
          <MoreHorizontal className="size-5" />
        </button>

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
              className="absolute bottom-36 right-0 z-20 flex w-[72px] translate-x-[26px] flex-col divide-y divide-white/15 overflow-hidden rounded-l-[50%] bg-black/55 pr-[24px] shadow-[0_16px_40px_rgba(0,0,0,0.45)] ring-1 ring-white/10 backdrop-blur"
            >
              <Link
                to="/create"
                onClick={(e) => e.stopPropagation()}
                aria-label="Create"
                className="grid h-14 w-full place-items-center pl-3 pt-3 text-white transition active:bg-white/5"
              >
                <Plus className="size-6" strokeWidth={2.5} />
              </Link>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onLike();
                }}
                aria-label="Like"
                aria-pressed={liked}
                className="flex h-14 w-full flex-col items-center justify-center gap-0.5 transition active:bg-white/5"
              >
                <Heart
                  className={`size-5 transition ${
                    liked
                      ? "scale-110 fill-[var(--color-magenta)] text-[var(--color-magenta)]"
                      : "text-white"
                  }`}
                />
                <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-white/70">
                  {likes}
                </span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowChips((s) => !s);
                }}
                aria-label="Comment"
                className="flex h-14 w-full flex-col items-center justify-center gap-0.5 transition active:bg-white/5"
              >
                <MessageCircle className="size-5 text-white" />
                <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-white/70">
                  {comments.length}
                </span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (navigator.share)
                    navigator.share({ title: "kinetic", url: window.location.href });
                }}
                aria-label="Share"
                className="grid h-14 w-full place-items-center pb-3 pl-3 text-white transition active:bg-white/5"
              >
                <Share2 className="size-5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="pointer-events-none absolute bottom-16 left-0 right-24 z-30 h-28 overflow-hidden">
          <AnimatePresence mode="wait">
            {showingFlyingComment && (
              <motion.div
                key={activeComment.key}
                initial={false}
                exit={{ opacity: 0, transition: { duration: 0.18 } }}
                className="pointer-events-auto absolute left-0 top-0 z-30 flex flex-col items-center gap-1"
                style={
                  {
                    maxWidth: commentMaxWidth,
                    "--chip-start-x": `${commentStartX}px`,
                    "--chip-end-x": `${commentEndX}px`,
                    animation: `chip-fly ${getCommentFlightDuration(getFloatingCommentLabel(activeCommentLabel))}ms linear forwards`,
                  } as CSSProperties & Record<string, string | number>
                }
              >
                <div className="relative max-w-full rounded-2xl rounded-bl-md bg-white/90 px-3 py-1.5 text-center text-sm font-semibold leading-snug text-black shadow-lg">
                  {getFloatingCommentLabel(activeCommentLabel)}
                  <span className="absolute -bottom-1 left-5 h-3 w-3 rotate-45 rounded-[2px] bg-white/90" />
                </div>
                <div className="flex items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white/75 backdrop-blur">
                  {activeCommentAuthor ? (
                    <Link
                      to="/u/$username"
                      params={{ username: activeCommentAuthor.username }}
                      onClick={(event) => event.stopPropagation()}
                      className="font-bold text-white"
                    >
                      {getProfileDisplayLabel(activeCommentAuthor)}
                    </Link>
                  ) : (
                    <span>someone</span>
                  )}
                  <span className="text-white/35">/</span>
                  <span>{formatShortDateTime(activeComment.created_at)}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div
          className={`absolute bottom-4 left-4 z-20 max-w-[min(70%,260px)] text-white transition-opacity duration-300 ${
            showingFlyingComment ? "opacity-30" : "opacity-100"
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
          {isPaused && !storyOpen && (
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
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="absolute bottom-36 right-3 z-30 flex flex-col items-end gap-2"
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
    <Link to={to} className="group flex items-center gap-2 text-white">
      <span className="rounded-full bg-black/40 px-2.5 py-1 text-right font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-white/80 opacity-95 shadow-[0_8px_24px_rgba(0,0,0,0.25)] backdrop-blur transition group-hover:text-white">
        {label}
      </span>
      <span
        className={`grid size-10 place-items-center rounded-full shadow-[0_12px_30px_rgba(0,0,0,0.3)] transition group-active:scale-95 ${
          emphasized
            ? "bg-white text-black"
            : "bg-black/45 text-white ring-1 ring-white/15 backdrop-blur"
        }`}
      >
        {icon}
      </span>
    </Link>
  );
}

function CommentStoryStack({
  stories,
  profilesById,
  onOpen,
}: {
  stories: CommentStory[];
  profilesById: Map<string, Profile>;
  onOpen: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
  const preview = stories.slice(-3);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="absolute bottom-4 right-3 z-30 h-[104px] w-[66px]"
      aria-label="Open animated comments"
    >
      {preview.map((story, index) => {
        const offset = preview.length - 1 - index;
        const background = getCommentStoryGradient(story.index);
        const storyAuthor = profilesById.get(story.user_id);
        return (
          <span
            key={story.id}
            className="absolute bottom-0 right-0 h-[102px] w-[54px] text-white"
            style={{
              zIndex: index + 1,
              transform: `translate(${-offset * 6}px, ${-offset * 7}px) rotate(${-offset * 3}deg)`,
            }}
          >
            <span
              aria-hidden
              className="absolute inset-0"
              style={{
                background,
                ...BUBBLE_MASK_STYLE,
                filter: "drop-shadow(0 12px 30px rgba(0,0,0,0.45))",
              }}
            />
            <span
              aria-hidden
              className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/45"
              style={BUBBLE_MASK_STYLE}
            />
            <span className="absolute inset-y-0 left-[7px] right-0 overflow-hidden rounded-[14px]">
              <span className="absolute inset-x-1.5 top-1.5 flex gap-0.5">
                <span className="h-0.5 flex-1 rounded-full bg-white/80" />
                <span className="h-0.5 flex-1 rounded-full bg-white/30" />
              </span>
              {storyAuthor && (
                <span className="absolute left-2 top-3.5 max-w-[78%] truncate font-mono text-[7px] font-bold uppercase tracking-[0.08em] text-white/70">
                  {getProfileDisplayLabel(storyAuthor)}
                </span>
              )}
              <span className="absolute inset-x-1 bottom-2 line-clamp-3 px-1 text-left text-[9px] font-black leading-[0.95] drop-shadow">
                {getCommentPreview(story.text)}
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
        className="relative aspect-[9/16] h-[85%] max-h-[85%] max-w-[92%] text-white drop-shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-[22px] right-0"
          style={{
            background,
            ...STORY_PLAYER_BUBBLE_MASK_STYLE,
          }}
        />
        <div
          className="absolute inset-y-0 -left-[22px] right-0 overflow-hidden"
          style={STORY_PLAYER_BUBBLE_MASK_STYLE}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_15%,rgba(255,255,255,0.22),transparent_30%),linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.52))]" />

          <div className="absolute inset-y-0 left-[22px] right-0">
            <div className="absolute inset-x-4 top-4 z-10">
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
                    className="grid size-7 place-items-center rounded-full bg-black/30 text-white backdrop-blur"
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
            />

            {!fastMode && storyPageCount > 1 && (
              <div className="absolute bottom-16 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
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

            <p className="absolute inset-x-4 bottom-4 z-10 text-right font-mono text-[9px] uppercase tracking-[0.14em] text-white/55">
              swipe to skip
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function AnimatedCommentStoryText({
  text,
  fullText,
  playKey,
  fastMode,
}: {
  text: string;
  fullText: string;
  playKey: number;
  fastMode: boolean;
}) {
  const displayText = fastMode ? fullText : text;
  const words = getWords(displayText);
  const emphasized = getEmphasizedWordIndexes(words);

  if (fastMode) {
    return (
      <div className="absolute inset-x-6 top-[18%] bottom-[16%] z-10 grid place-items-center">
        <motion.p
          key={playKey}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-h-full overflow-hidden text-center font-black leading-[1.02] text-white drop-shadow-[0_8px_34px_rgba(0,0,0,0.55)]"
          style={{ fontSize: "clamp(1.15rem, 3.5vh, 1.85rem)" }}
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
                color: important ? "#FFBE0B" : "#ffffff",
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

function paginateText(text: string) {
  const blocks = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((block) => block.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
  if (blocks.length === 0) return [""];

  return blocks.flatMap((block) => paginateTextBlock(block));
}

function paginateTextBlock(text: string) {
  const wordLimit = getTextPageWordLimit(text);
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [text];
  return sentences
    .flatMap((sentence) => chunkSentenceByWords(sentence.trim(), wordLimit))
    .filter(Boolean);
}

function chunkSentenceByWords(sentence: string, wordLimit: number) {
  const words = sentence.match(/\S+/g) ?? [];
  if (words.length <= wordLimit) return [sentence];

  const pageCount = Math.ceil(words.length / wordLimit);
  const targetWordsPerPage = Math.ceil(words.length / pageCount);
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += targetWordsPerPage) {
    chunks.push(words.slice(i, i + targetWordsPerPage).join(" "));
  }

  return chunks;
}

function getPageTextSize(baseSize: number, text: string) {
  const wordCount = getWords(text).length;
  if (wordCount >= 9) return Math.min(baseSize, 72);
  if (wordCount >= 7) return Math.min(baseSize, 78);
  if (wordCount >= 5) return Math.min(baseSize, 88);
  if (wordCount >= 3) return Math.min(baseSize, 98);
  return baseSize;
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
    "linear-gradient(135deg,#073B4C,#06D6A0)",
  ];
  return gradients[index % gradients.length];
}

function getCommentPreview(text: string) {
  const words = getWords(text);
  if (words.length <= 5) return text;
  return `${words.slice(0, 5).join(" ")}...`;
}

function getProfileDisplayLabel(profile: Profile) {
  return profile.display_name.trim() || `@${profile.username}`;
}

function getPostHashtags(text: string, postType: string) {
  const explicitTags = Array.from(text.matchAll(/#([a-z0-9][a-z0-9_-]{1,24})/gi)).map((match) =>
    normalizeHashtag(match[1]),
  );
  const textTags = getWords(text)
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
}: {
  spec: CanvasSpec;
  playKey: number;
  paused: boolean;
  revealed: boolean;
  canvasWidth: number;
}) {
  const words = getWords(spec.text);
  const isVietnamese = isLikelyVietnameseText(spec.text);
  const vietnameseLines = isVietnamese ? getVietnameseWordLines(words) : [];
  const emphasized = getEmphasizedWordIndexes(words);
  const tempo = tempoConfig[spec.tempo];
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const fontSize = spec.size * fitScale;

  useEffect(() => {
    setFitScale(1);
  }, [
    canvasWidth,
    spec.color,
    spec.font,
    spec.letterSpacing,
    spec.rotation,
    spec.size,
    spec.text,
    spec.weight,
  ]);

  useIsomorphicLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const text = textRef.current;
    const canvas = wrapper?.parentElement?.parentElement;
    if (!wrapper || !text || !canvas) return;

    const wrapperWidth = wrapper.clientWidth;
    const canvasHeight = canvas.getBoundingClientRect().height;
    if (!wrapperWidth || !canvasHeight) return;

    const verticalRoom = (canvasHeight * Math.min(spec.y, 100 - spec.y) * 2) / 100;
    const maxHeight = Math.max(canvasHeight * 0.45, verticalRoom * 0.86);
    const widthRatio = wrapperWidth / Math.max(text.scrollWidth, 1);
    const heightRatio = maxHeight / Math.max(text.scrollHeight, 1);
    const nextFit = Math.min(1, fitScale * Math.min(widthRatio, heightRatio) * 0.98);

    if (nextFit < fitScale - 0.01) {
      setFitScale(Math.max(MIN_TEXT_FIT_SCALE, nextFit));
    }
  }, [
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
  ]);

  const renderWord = (word: string, index: number) => {
    const important = emphasized.has(index);
    return (
      <motion.span
        key={`${word}-${index}`}
        variants={{
          hidden: {
            opacity: 0,
            y: important ? 34 : 22,
            scale: important ? 0.74 : 0.88,
            filter: "blur(10px)",
          },
          show: {
            opacity: 1,
            y: 0,
            scale: important ? 1.12 : 1,
            filter: "blur(0px)",
          },
        }}
        transition={{
          delay: revealed ? 0 : getWordDelay(index, spec.tempo, spec.rhythm),
          duration: revealed ? 0.01 : important ? tempo.wordDuration * 1.22 : tempo.wordDuration,
          ease: [0.22, 1, 0.36, 1],
        }}
        className={important ? "relative inline-flex" : "inline-flex"}
        style={{
          color: important ? getEmphasisColor(spec.color) : spec.color,
          display: "inline-block",
          fontWeight: important ? 900 : spec.weight,
          overflowWrap: "normal",
          whiteSpace: "nowrap",
          wordBreak: "normal",
          textShadow: important
            ? "0 0 22px rgba(255,255,255,0.35), 0 5px 36px rgba(0,0,0,0.55)"
            : "0 4px 40px rgba(0,0,0,0.45)",
          animationPlayState: paused ? "paused" : "running",
        }}
      >
        {word}
      </motion.span>
    );
  };

  return (
    <div
      ref={wrapperRef}
      className="pointer-events-none absolute select-none"
      style={{
        left: `${spec.x}%`,
        top: `${spec.y}%`,
        transform: "translate(-50%, -50%)",
        width: isVietnamese ? TEXT_SAFE_MAX_WIDTH : undefined,
        maxWidth: TEXT_SAFE_MAX_WIDTH,
      }}
    >
      <motion.div
        ref={textRef}
        key={`${playKey}-${revealed ? "revealed" : "animated"}`}
        className={
          isVietnamese
            ? "flex flex-col items-stretch"
            : "flex flex-wrap items-center justify-center"
        }
        initial={revealed ? false : "hidden"}
        animate="show"
        style={{
          columnGap: isVietnamese ? undefined : "0.24em",
          rowGap: isVietnamese ? undefined : "0.08em",
          fontFamily: spec.font,
          fontSize,
          color: spec.color,
          fontWeight: spec.weight,
          letterSpacing: `${spec.letterSpacing}em`,
          lineHeight: isVietnamese ? 1.04 : 0.9,
          textAlign: isVietnamese ? "left" : "center",
          textShadow: "0 4px 40px rgba(0,0,0,0.45)",
          transform: `rotate(${spec.rotation}deg)`,
          animation: getLoopAnimation(spec.loop, spec.tempo),
          animationPlayState: paused ? "paused" : "running",
        }}
      >
        {isVietnamese
          ? vietnameseLines.map((line, lineIndex) => (
              <div
                key={`${lineIndex}-${line.indentCh}`}
                className="flex flex-wrap items-baseline justify-start"
                style={{
                  boxSizing: "border-box",
                  columnGap: "0.24em",
                  rowGap: "0.08em",
                  marginTop: lineIndex === 0 ? 0 : "0.06em",
                  minWidth: 0,
                  paddingLeft: `${line.indentCh}ch`,
                  paddingRight: "2%",
                  width: "100%",
                }}
              >
                {line.words.map(({ text, index }) => renderWord(text, index))}
              </div>
            ))
          : words.map((word, index) => renderWord(word, index))}
      </motion.div>
    </div>
  );
}

function getWords(text: string) {
  return text.match(/\S+/g) ?? [];
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

function getEmphasisColor(color: string) {
  const normalized = color.trim().toLowerCase();
  if (normalized === "#000000" || normalized === "black") return "#8338EC";
  if (normalized === "#ffbe0b") return "#ffffff";
  return "#FFBE0B";
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
