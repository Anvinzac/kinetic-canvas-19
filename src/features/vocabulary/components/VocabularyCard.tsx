/** One independent vocabulary learning card; clue navigation and heart/bookmark reactions stay on-device, and the reveal is followed by a letter-by-letter spelling coda. Exports: VocabularyCard. Depends on: presets, playback, VocabularyStage, SpellingAnimation, reactions. */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { getCanvasPatternTheme, getCanvasSceneTheme } from "@/features/canvas";
import {
  PostCanvasBackdrop,
  getSlidingCanvasBackground,
  getPageDuration,
  getUniformPageTextSize,
} from "@/features/post-player";
import { AnimatePresence, motion } from "framer-motion";
import { Bookmark, Heart } from "lucide-react";
import { buildVocabularyCanvas, choosePresentation, fitVocabularyTextSize } from "../lib/presets";
import { buildStages } from "../lib/stages";
import { getSpellingDurationMs, pickSpellingVariant } from "../lib/spelling";
import {
  REACTIONS_EVENT,
  REACTIONS_KEY,
  addEmojiComment,
  flipReaction,
  getTapCount,
  hasReaction,
  type ReactionKind,
} from "../lib/reactions";
import { useLearningPlayback } from "../hooks/useLearningPlayback";
import type { FeedEntry, Presentation } from "../types";
import { SpellingAnimation } from "./SpellingAnimation";
import { VocabularyStage } from "./VocabularyStage";
import { EMOJI_PALETTE } from "./EmojiReactions";

/** Play a single occurrence, keeping answer content hidden until reveal. @param props Entry/display settings. @returns Full-height card. */
export function VocabularyCard({
  entry,
  presentation,
  active,
  reducedMotion,
  matching,
  canAdvance,
  onAdvance,
}: {
  entry: FeedEntry;
  presentation: Presentation;
  active: boolean;
  reducedMotion: boolean;
  matching: number;
  canAdvance: boolean;
  onAdvance: () => void;
}) {
  const { theme, style } = choosePresentation(entry.occurrenceId, presentation);
  const stages = useMemo(() => buildStages(entry.word, style.id), [entry.word, style.id]);
  const canvas = useMemo(() => buildVocabularyCanvas(theme, style), [theme, style]);
  // The spelling coda is one extra page appended after the reveal stage, so the
  // playback timer — not the animation component — decides when the card ends.
  const spellingVariant = useMemo(
    () => pickSpellingVariant(entry.occurrenceId),
    [entry.occurrenceId],
  );
  const spellingDuration = useMemo(
    () => getSpellingDurationMs(entry.word.word, spellingVariant, reducedMotion),
    [entry.word.word, spellingVariant, reducedMotion],
  );
  const revealPage = stages.length - 1;
  const pageCount = stages.length + 1;
  /** Progress-bar keys: one per clue stage plus the trailing spelling coda. */
  const pageKeys = useMemo(() => [...stages.map((item) => item.id), "spelling"], [stages]);
  const cardRef = useRef<HTMLElement>(null);
  const [{ width, height }, setSize] = useState({ width: 390, height: 844 });
  useLayoutEffect(() => {
    const element = cardRef.current;
    if (!element) return;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const playback = useLearningPlayback({
    count: pageCount,
    active,
    autoplay: presentation.autoplay,
    reducedMotion,
    durations: [
      ...stages.map((stage) =>
        getPageDuration(
          [stage.text, stage.reveal ? entry.word.defVi : ""].filter(Boolean).join(" "),
          style.tempo,
          style.rhythm,
        ),
      ),
      spellingDuration,
    ],
    canAdvance,
    revealPage,
    onFinish: onAdvance,
  });
  const isSpelling = playback.page > revealPage;
  // During the coda there is no matching stage; the answer stage stays mounted
  // underneath so its reveal details and unlocked reactions persist.
  const stage = stages[Math.min(playback.page, revealPage)]!;
  // Reveal page — emoji strip replaces the action bar so tapping an emoji both
  // comments and advances to the spelling coda.
  const isAnticipation = !isSpelling && playback.page === revealPage;
  const playKey = playback.replay * pageCount + playback.page;
  const sceneTheme = getCanvasSceneTheme(canvas.backgroundScene);
  const patternTheme = getCanvasPatternTheme(canvas.backgroundPattern);
  const sliding =
    sceneTheme || patternTheme
      ? null
      : getSlidingCanvasBackground(canvas, theme.background, reducedMotion ? 0 : playback.page);
  // Only the single active card animates the sweeping transition backdrop. Inactive
  // neighbours keep a static gradient, so a transient active-index flip can never make
  // every visible background strobe at once.
  const sweep = !!sliding && !reducedMotion && active;
  const cluePages = stages.filter((item) => !item.reveal).map((item) => item.text);
  const textSize = fitVocabularyTextSize(
    stage.text,
    getUniformPageTextSize(
      Math.max(96, Math.min(160, width * 0.13)),
      cluePages,
      cluePages.join(" "),
    ),
    width,
    height,
  );
  const colors = {
    "--vocab-ink": theme.ink,
    "--vocab-accent": theme.accent,
    "--vocab-button-ink": theme.ink === "#ffffff" ? "#252136" : "#ffffff",
    background: theme.background,
    color: theme.ink,
    fontFamily: `${theme.font}, sans-serif`,
  } as CSSProperties;

  // Gesture handling: tap left/right + horizontal swipe for clue navigation.
  const gestureStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const handlePointerStart = useCallback(
    (clientX: number, clientY: number, target: EventTarget | null) => {
      if (
        target instanceof Element &&
        target.closest("button, a, input, select, textarea, [data-no-gesture]")
      ) {
        // Element (not HTMLElement): taps land on SVG icons inside buttons, and
        // SVGElement must be excluded or reaction taps would also flip pages.
        gestureStart.current = null;
        return;
      }
      gestureStart.current = { x: clientX, y: clientY, t: Date.now() };
    },
    [],
  );
  const handlePointerEnd = useCallback(
    (clientX: number, clientY: number) => {
      const start = gestureStart.current;
      gestureStart.current = null;
      if (!start) return;
      const dx = clientX - start.x;
      const dy = clientY - start.y;
      const dt = Date.now() - start.t;
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      // Horizontal swipe
      if ((ax > 44 || ay > 44) && ax > ay) {
        if (dx < -44) {
          if (isSpelling) onAdvance();
          else if (!stage.reveal) playback.next();
        } else if (dx > 44) {
          playback.previous();
        }
        return;
      }
      // Vertical swipe is handled by VocabularyStream for word navigation; ignore here.
      if (ay > 44 && ay > ax) return;
      // Tap
      if (dt < 600 && ax < 16 && ay < 16) {
        // During the spelling coda a tap means "I have it" — skip to the next word.
        if (isSpelling) {
          onAdvance();
          return;
        }
        const rect = cardRef.current?.getBoundingClientRect();
        if (!rect) return;
        const relX = clientX - rect.left;
        const leftZone = rect.width * 0.33;
        const rightZone = rect.width * 0.66;
        if (relX < leftZone) {
          playback.previous();
        } else if (relX > rightZone) {
          if (stage.reveal) playback.restart();
          else playback.next();
        } else {
          // Center tap reveals or restarts
          if (stage.reveal) playback.restart();
          else playback.reveal();
        }
      }
    },
    [playback, stage.reveal, isSpelling, onAdvance],
  );

  void matching;

  // Heart / bookmark: everything stays on-device. Both the toggle flag and the
  // cumulative tap counter live in localStorage, so no request is made and no
  // account exists — the numbers shown are this reader's own.
  const wordId = entry.word.id;
  const [reactions, setReactions] = useState(() => ({
    heart: hasReaction(wordId, "heart"),
    bookmark: hasReaction(wordId, "bookmark"),
  }));
  const [taps, setTaps] = useState(() => ({
    heart: getTapCount(wordId, "heart"),
    bookmark: getTapCount(wordId, "bookmark"),
  }));
  const readLocalReactions = useCallback(() => {
    setReactions({
      heart: hasReaction(wordId, "heart"),
      bookmark: hasReaction(wordId, "bookmark"),
    });
    setTaps({
      heart: getTapCount(wordId, "heart"),
      bookmark: getTapCount(wordId, "bookmark"),
    });
  }, [wordId]);
  useEffect(() => {
    readLocalReactions();
  }, [readLocalReactions, active]);
  // The cycling stream can mount the same word twice, and the saved-words page
  // writes the same key, so re-read on both the cross-tab and same-tab signal.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === REACTIONS_KEY) readLocalReactions();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(REACTIONS_EVENT, readLocalReactions);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(REACTIONS_EVENT, readLocalReactions);
    };
  }, [readLocalReactions]);
  const toggleReaction = useCallback(
    (kind: ReactionKind) => {
      // Reactions unlock only once the definition is revealed.
      if (!stage.reveal) return;
      // flipReaction bumps the tap counter itself when the reaction turns on.
      flipReaction(wordId, kind);
      readLocalReactions();
    },
    [stage.reveal, wordId, readLocalReactions],
  );
  const reactionLocked = !stage.reveal;
  const heartsLabel = formatReactionCount(taps.heart);
  const bookmarksLabel = formatReactionCount(taps.bookmark);

  return (
    <article
      ref={cardRef}
      className="vocab-card"
      style={colors}
      data-theme={theme.id}
      data-stage={isSpelling ? "spelling" : stage.id}
      inert={!active}
      aria-hidden={!active}
      aria-label={`Vocabulary card ${entry.position + 1}`}
      aria-posinset={entry.position + 1}
      aria-setsize={-1}
      onTouchStart={(e) => {
        const t = e.touches[0];
        if (t) handlePointerStart(t.clientX, t.clientY, e.target);
      }}
      onTouchEnd={(e) => {
        const t = e.changedTouches[0];
        if (t) handlePointerEnd(t.clientX, t.clientY);
      }}
      onMouseDown={(e) => {
        // Only for desktop click preview; store for mouse up
        if (e.button !== 0) return;
        handlePointerStart(e.clientX, e.clientY, e.target);
      }}
      onMouseUp={(e) => handlePointerEnd(e.clientX, e.clientY)}
    >
      <div className="vocab-backdrop" aria-hidden="true">
        <PostCanvasBackdrop
          postId={entry.occurrenceId}
          backgroundShiftPage={reducedMotion ? 0 : playback.page}
          sceneTheme={sceneTheme}
          patternTheme={patternTheme}
          slidingCanvasBackground={sliding}
          staticCanvasBackground={theme.background}
          hasTransitionBackground={sweep}
        />
      </div>
      {isSpelling ? (
        <SpellingAnimation
          word={entry.word.word}
          variant={spellingVariant}
          reducedMotion={reducedMotion}
        />
      ) : (
        <VocabularyStage
          stage={stage}
          word={entry.word}
          spec={{ ...canvas, text: stage.text, size: stage.reveal ? 128 : textSize }}
          background={theme.background}
          canvasWidth={width}
          active={active}
          playing={playback.playing}
          reducedMotion={reducedMotion}
          playKey={playKey}
        />
      )}
      {!isSpelling && <p className="vocab-stage-label">{stage.label}</p>}
      <div className="vocab-progress" aria-label={`Page ${playback.page + 1} of ${pageCount}`}>
        {pageKeys.map((key, index) => (
          <span key={key} data-complete={index < playback.page}>
            {index === playback.page && (
              <i
                key={`${playKey}-${playback.playing}`}
                style={{
                  animationDuration: `${playback.duration}ms`,
                  animationPlayState: playback.playing ? "running" : "paused",
                }}
              />
            )}
          </span>
        ))}
      </div>

      <div
        className="vocab-action-bar"
        data-anticipation={isAnticipation || undefined}
        data-no-gesture
      >
        <AnimatePresence mode="wait">
          {isAnticipation ? (
            <motion.div
              key="emoji-strip"
              className="vocab-emoji-strip"
              initial={{ opacity: 0, scale: 0.85, filter: "blur(4px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.85, filter: "blur(4px)" }}
              transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {EMOJI_PALETTE.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="vocab-emoji-strip-btn"
                  onClick={() => addEmojiComment(wordId, emoji)}
                >
                  {emoji}
                </button>
              ))}
              <div className="vocab-emoji-strip-sep" aria-hidden="true" />
              <button
                type="button"
                className="vocab-emoji-strip-btn vocab-reaction-heart"
                data-on={reactions.heart || undefined}
                disabled={reactionLocked}
                onClick={() => toggleReaction("heart")}
                aria-label={
                  reactions.heart ? "Remove your heart from this word" : "Heart this word"
                }
              >
                <Heart size={16} fill={reactions.heart ? "currentColor" : "none"} />
              </button>
              <button
                type="button"
                className="vocab-emoji-strip-btn vocab-reaction-bookmark"
                data-on={reactions.bookmark || undefined}
                disabled={reactionLocked}
                onClick={() => toggleReaction("bookmark")}
                aria-label={reactions.bookmark ? "Remove this word from saved" : "Save this word"}
              >
                <Bookmark size={16} fill={reactions.bookmark ? "currentColor" : "none"} />
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="action-bar"
              className="vocab-action-row"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: reducedMotion ? 0 : 0.22 }}
            >
              {!stage.reveal && (
                <button
                  type="button"
                  className="vocab-reveal-button vocab-reveal-pill"
                  onClick={playback.reveal}
                  aria-label="Reveal word"
                >
                  Ê, từ này biết nè
                </button>
              )}
              <div className="vocab-reaction">
                <button
                  type="button"
                  className="vocab-reaction-button vocab-reaction-heart"
                  data-on={reactions.heart || undefined}
                  disabled={reactionLocked}
                  onClick={() => toggleReaction("heart")}
                  aria-label={
                    reactions.heart ? "Remove your heart from this word" : "Heart this word"
                  }
                >
                  <Heart size={17} fill={reactions.heart ? "currentColor" : "none"} />
                </button>
                <span className="vocab-reaction-count">{heartsLabel}</span>
              </div>
              <div className="vocab-reaction">
                <button
                  type="button"
                  className="vocab-reaction-button vocab-reaction-bookmark"
                  data-on={reactions.bookmark || undefined}
                  disabled={reactionLocked}
                  onClick={() => toggleReaction("bookmark")}
                  aria-label={reactions.bookmark ? "Remove this word from saved" : "Save this word"}
                >
                  <Bookmark size={17} fill={reactions.bookmark ? "currentColor" : "none"} />
                </button>
                <span className="vocab-reaction-count">{bookmarksLabel}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </article>
  );
}

/** Compact local tap-count label shown under a reaction button. */
function formatReactionCount(value: number): string {
  if (!value) return "";
  if (value >= 1000) {
    const thousands = value / 1000;
    return `${thousands >= 10 ? Math.round(thousands) : thousands.toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(value);
}
