import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, MessageCircle, MoreVertical, Play, RotateCcw, Share2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { COMMENT_CHIPS, parseCanvas, type CanvasSpec } from "@/lib/canvas";

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
type FlowComment = { key: string; chip: string; created_at: string };

const MAX_WORDS_PER_TEXT_PAGE = 7;
const MAX_COMMENT_WORDS = 10;

const loopAnim: Record<string, string | undefined> = {
  pulse: "kinetic-pulse 2.4s ease-in-out infinite",
  float: "kinetic-float 3.2s ease-in-out infinite",
  shake: "kinetic-shake 0.4s ease-in-out infinite",
  none: undefined,
};

export function PostCard({
  post,
  author,
  likes,
  comments,
  liked,
  onLike,
  onComment,
}: {
  post: Post;
  author?: Profile;
  likes: number;
  comments: Comment[];
  liked: boolean;
  onLike: () => void;
  onComment: (chip: string) => void;
}) {
  const spec = parseCanvas(post.canvas_html);
  const textPages = useMemo(() => paginateText(spec.text), [spec.text]);
  const chronologicalComments = useMemo(
    () =>
      [...comments].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      ),
    [comments],
  );
  const commentFlowKey = chronologicalComments
    .map((comment) => `${comment.id}:${comment.created_at}:${comment.chip_id}`)
    .join("|");

  const [slide, setSlide] = useState(0);
  const [textPage, setTextPage] = useState(0);
  const [playKey, setPlayKey] = useState(0);
  const [showChips, setShowChips] = useState(false);
  const [customComment, setCustomComment] = useState("");
  const [activeComment, setActiveComment] = useState<FlowComment | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(390);
  const flyId = useRef(0);
  const manualCommentHoldUntil = useRef(0);
  const canvasRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const media = post.media_urls ?? [];
  const commentMaxWidth = Math.min(canvasWidth * 0.72, 290);
  const commentStartX = canvasWidth + 16;
  const commentEndX = -(commentMaxWidth + 24);
  const currentText = textPages[textPage] ?? textPages[0] ?? "";
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
  }, [post.id, spec.text]);

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
    if (textPages.length < 2) return;
    const timer = window.setTimeout(() => {
      // Rule: slideshow media advances only with text pages, never mid-sentence.
      const nextPage = (textPage + 1) % textPages.length;
      setTextPage(nextPage);
      if (post.post_type === "slideshow" && media.length > 1) {
        setSlide(nextPage % media.length);
      }
      setPlayKey((key) => key + 1);
    }, getPageDuration(currentText));
    return () => window.clearTimeout(timer);
  }, [currentText, isPaused, media.length, post.id, post.post_type, textPage, textPages.length]);

  useEffect(() => {
    if (isPaused) {
      setActiveComment(null);
      return;
    }
    if (chronologicalComments.length === 0) {
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

      const comment = chronologicalComments[index % chronologicalComments.length];
      const label = getCommentLabel(comment.chip_id);
      setActiveComment({
        key: `${comment.id}-${index}`,
        chip: comment.chip_id,
        created_at: comment.created_at,
      });
      index += 1;
      timer = window.setTimeout(showNext, getCommentFlightDuration(label) + 700);
    };

    showNext();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [commentFlowKey, chronologicalComments, isPaused]);

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

  function pauseCanvas() {
    setShowChips(false);
    setIsPaused(true);
  }

  function resetCurrentPage() {
    setIsPaused(false);
    setPlayKey((key) => key + 1);
    setActiveComment(null);
  }

  function replayFromBeginning() {
    setIsPaused(false);
    setTextPage(0);
    setSlide(0);
    setPlayKey((key) => key + 1);
    setActiveComment(null);
  }

  function selectTextPage(page: number) {
    setIsPaused(false);
    setTextPage(page);
    if (post.post_type === "slideshow" && media.length > 1) {
      setSlide(page % media.length);
    }
    setPlayKey((key) => key + 1);
  }

  function flyChip(chipId: string) {
    flyId.current += 1;
    manualCommentHoldUntil.current =
      Date.now() + getCommentFlightDuration(getCommentLabel(chipId)) + 700;
    setActiveComment({
      key: `local-${flyId.current}`,
      chip: chipId,
      created_at: new Date().toISOString(),
    });
  }

  function submitComment(value: string) {
    const normalized = normalizeComment(value);
    if (!normalized || getWords(normalized).length > MAX_COMMENT_WORDS) return;
    flyChip(normalized);
    onComment(normalized);
    setCustomComment("");
    setShowChips(false);
  }

  return (
    <section className="relative flex h-[100dvh] w-full snap-start items-center justify-center overflow-hidden bg-background pb-24 pt-3 sm:py-6">
      <article
        ref={canvasRef}
        className="relative aspect-[9/16] overflow-hidden bg-black shadow-[0_24px_90px_rgba(0,0,0,0.45)] sm:rounded-[28px] sm:ring-1 sm:ring-white/10"
        style={{
          height: "min(calc(100dvh - 6rem), 764px, 177.777vw)",
          background: post.bg_gradient ?? "#000",
        }}
        onClick={pauseCanvas}
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
            <WordSequenceText spec={displaySpec} playKey={playKey} paused={isPaused} />
          </motion.div>
        </AnimatePresence>

        {textPages.length > 1 && (
          <div
            className="absolute left-1/2 top-4 z-20 flex -translate-x-1/2 gap-1.5"
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
            className="absolute left-4 top-12 z-20 flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={author.avatar_url ?? ""}
              alt=""
              className="size-9 rounded-full border-2 border-white/80"
            />
            <div>
              <p className="text-sm font-bold text-white drop-shadow">@{author.username}</p>
              <p className="text-[10px] uppercase tracking-widest text-white/70 drop-shadow">
                {post.post_type}
              </p>
            </div>
          </Link>
        )}

        <div className="absolute bottom-28 right-3 z-20 flex flex-col items-center gap-5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLike();
            }}
            className="flex flex-col items-center gap-1"
          >
            <span
              className={`flex size-12 items-center justify-center rounded-full transition ${
                liked ? "bg-[var(--color-magenta)] scale-110" : "bg-black/40 backdrop-blur"
              }`}
            >
              <Heart className={`size-6 ${liked ? "fill-white text-white" : "text-white"}`} />
            </span>
            <span className="text-xs font-bold text-white drop-shadow">{likes}</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowChips((s) => !s);
            }}
            className="flex flex-col items-center gap-1"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-black/40 backdrop-blur">
              <MessageCircle className="size-6 text-white" />
            </span>
            <span className="text-xs font-bold text-white drop-shadow">{comments.length}</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (navigator.share) navigator.share({ title: "kinetic", url: window.location.href });
            }}
            className="flex flex-col items-center gap-1"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-black/40 backdrop-blur">
              <Share2 className="size-5 text-white" />
            </span>
          </button>

          <button
            onClick={(e) => e.stopPropagation()}
            className="flex size-12 items-center justify-center rounded-full bg-black/40 backdrop-blur"
          >
            <MoreVertical className="size-5 text-white" />
          </button>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-16 z-30 h-28 overflow-hidden">
          <AnimatePresence mode="wait">
            {!isPaused && activeComment && (
              <motion.div
                key={activeComment.key}
                initial={false}
                exit={{ opacity: 0, transition: { duration: 0.18 } }}
                className="absolute left-0 top-0 z-30 flex flex-col items-center gap-1"
                style={
                  {
                    maxWidth: commentMaxWidth,
                    "--chip-start-x": `${commentStartX}px`,
                    "--chip-end-x": `${commentEndX}px`,
                    animation: `chip-fly ${getCommentFlightDuration(getCommentLabel(activeComment.chip))}ms linear forwards`,
                  } as CSSProperties & Record<string, string | number>
                }
              >
                <div className="max-w-full rounded-2xl bg-white/90 px-3 py-1.5 text-center text-sm font-semibold leading-snug text-black shadow-lg">
                  {getCommentLabel(activeComment.chip)}
                </div>
                <span className="rounded-full bg-black/35 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white/75 backdrop-blur">
                  {formatShortDateTime(activeComment.created_at)}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="absolute bottom-4 left-4 z-20 rounded-full bg-black/35 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/75 backdrop-blur">
          {formatPostDate(post.created_at)}
        </div>

        <AnimatePresence>
          {isPaused && (
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
                  onChange={(event) => setCustomComment(limitCommentWords(event.target.value))}
                  placeholder="add a short comment"
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
                <span>{getWords(customComment).length}/10</span>
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

function paginateText(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [""];

  const sentences = clean.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [clean];
  return sentences.flatMap((sentence) => chunkSentenceByWords(sentence.trim())).filter(Boolean);
}

function chunkSentenceByWords(sentence: string) {
  const words = sentence.match(/\S+/g) ?? [];
  if (words.length <= MAX_WORDS_PER_TEXT_PAGE) return [sentence];

  const pageCount = Math.ceil(words.length / MAX_WORDS_PER_TEXT_PAGE);
  const targetWordsPerPage = Math.ceil(words.length / pageCount);
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += targetWordsPerPage) {
    chunks.push(words.slice(i, i + targetWordsPerPage).join(" "));
  }

  return chunks;
}

function getPageTextSize(baseSize: number, text: string) {
  const wordCount = getWords(text).length;
  if (wordCount >= 7) return Math.min(baseSize, 58);
  if (wordCount >= 5) return Math.min(baseSize, 68);
  if (wordCount >= 3) return Math.min(baseSize, 82);
  return baseSize;
}

function getPageDuration(text: string) {
  const wordCount = getWords(text).length;
  return Math.max(3200, Math.min(5200, 1900 + wordCount * 430));
}

function getCommentFlightDuration(label: string) {
  return Math.max(5600, Math.min(8400, 4300 + label.length * 55));
}

function WordSequenceText({
  spec,
  playKey,
  paused,
}: {
  spec: CanvasSpec;
  playKey: number;
  paused: boolean;
}) {
  const words = getWords(spec.text);
  const emphasized = getEmphasizedWordIndexes(words);

  return (
    <div
      className="pointer-events-none absolute select-none"
      style={{
        left: `${spec.x}%`,
        top: `${spec.y}%`,
        transform: "translate(-50%, -50%)",
        maxWidth: "86%",
      }}
    >
      <motion.div
        key={playKey}
        className="flex flex-wrap items-center justify-center"
        initial="hidden"
        animate="show"
        style={{
          columnGap: "0.24em",
          rowGap: "0.08em",
          fontFamily: spec.font,
          fontSize: spec.size,
          color: spec.color,
          fontWeight: spec.weight,
          letterSpacing: `${spec.letterSpacing}em`,
          lineHeight: 0.9,
          textAlign: "center",
          textShadow: "0 4px 40px rgba(0,0,0,0.45)",
          transform: `rotate(${spec.rotation}deg)`,
          animation: loopAnim[spec.loop],
          animationPlayState: paused ? "paused" : "running",
        }}
      >
        {words.map((word, index) => {
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
                delay: index * 0.18,
                duration: important ? 0.62 : 0.5,
                ease: [0.22, 1, 0.36, 1],
              }}
              className={important ? "relative inline-flex" : "inline-flex"}
              style={{
                color: important ? getEmphasisColor(spec.color) : spec.color,
                fontWeight: important ? 900 : spec.weight,
                textShadow: important
                  ? "0 0 22px rgba(255,255,255,0.35), 0 5px 36px rgba(0,0,0,0.55)"
                  : "0 4px 40px rgba(0,0,0,0.45)",
                animationPlayState: paused ? "paused" : "running",
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

function getWords(text: string) {
  return text.match(/\S+/g) ?? [];
}

function normalizeComment(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function limitCommentWords(value: string) {
  const words = getWords(value);
  if (words.length <= MAX_COMMENT_WORDS) return value;
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
