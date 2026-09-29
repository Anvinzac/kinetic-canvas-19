/** One independent vocabulary learning card; clue navigation stays local while heart/bookmark reactions post to the public engagement totals. Exports: VocabularyCard. Depends on: presets, playback, VocabularyStage, engagement api. */
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
import { Bookmark, Heart, RotateCcw, Sparkles } from "lucide-react";
import { buildVocabularyCanvas, choosePresentation, fitVocabularyTextSize } from "../lib/presets";
import { buildStages } from "../lib/stages";
import { flipReaction, hasReaction, type ReactionKind } from "../lib/reactions";
import {
  changeEngagement,
  getCachedEngagement,
  loadEngagement,
  type EngagementCounts,
} from "../api/engagement";
import { useLearningPlayback } from "../hooks/useLearningPlayback";
import type { FeedEntry, Presentation } from "../types";
import { VocabularyStage } from "./VocabularyStage";

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
    count: stages.length,
    active,
    autoplay: presentation.autoplay,
    reducedMotion,
    durations: stages.map((stage) =>
      getPageDuration(
        [stage.text, stage.reveal ? entry.word.defVi : ""].filter(Boolean).join(" "),
        style.tempo,
        style.rhythm,
      ),
    ),
    canAdvance,
    onFinish: onAdvance,
  });
  const stage = stages[playback.page];
  const playKey = playback.replay * stages.length + playback.page;
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
          if (!stage.reveal) playback.next();
        } else if (dx > 44) {
          playback.previous();
        }
        return;
      }
      // Vertical swipe is handled by VocabularyStream for word navigation; ignore here.
      if (ay > 44 && ay > ax) return;
      // Tap
      if (dt < 600 && ax < 16 && ay < 16) {
        const rect = cardRef.current?.getBoundingClientRect();
        if (!rect) return;
        const relX = clientX - rect.left;
        const leftZone = rect.width * 0.33;
        const rightZone = rect.width * 0.66;
        if (relX < leftZone) {
          playback.previous();
        } else if (relX > rightZone) {
          if (stage.reveal) playback.restart();
          else if (playback.page === stages.length - 2) playback.reveal();
          else playback.next();
        } else {
          // Center tap reveals or restarts
          if (stage.reveal) playback.restart();
          else playback.reveal();
        }
      }
    },
    [playback, stage.reveal, stages.length],
  );

  void matching;

  // Heart / bookmark: totals come from the public engagement store; this device
  // tracks its own taps in localStorage so they toggle instead of stacking.
  const wordId = entry.word.id;
  const [counts, setCounts] = useState<EngagementCounts | null>(() => getCachedEngagement(wordId));
  const [reactions, setReactions] = useState(() => ({
    heart: hasReaction(wordId, "heart"),
    bookmark: hasReaction(wordId, "bookmark"),
  }));
  useEffect(() => {
    setReactions({
      heart: hasReaction(wordId, "heart"),
      bookmark: hasReaction(wordId, "bookmark"),
    });
    setCounts(getCachedEngagement(wordId));
    if (!active) return;
    let alive = true;
    void loadEngagement(wordId).then((fresh) => {
      if (alive && fresh) setCounts(fresh);
    });
    return () => {
      alive = false;
    };
  }, [active, wordId]);
  const toggleReaction = useCallback(
    (kind: ReactionKind) => {
      // Reactions unlock only once the definition is revealed.
      if (!stage.reveal) return;
      const nextActive = flipReaction(wordId, kind);
      setReactions((r) => ({ ...r, [kind]: nextActive }));
      const before = getCachedEngagement(wordId);
      if (before) {
        const delta = nextActive ? 1 : -1;
        setCounts(
          kind === "heart"
            ? { ...before, hearts: Math.max(0, before.hearts + delta) }
            : { ...before, bookmarks: Math.max(0, before.bookmarks + delta) },
        );
      }
      void changeEngagement(wordId, kind, nextActive).then((authoritative) => {
        if (authoritative) setCounts(authoritative);
        else if (before) {
          setCounts(before);
          flipReaction(wordId, kind); // roll the device flag back so counts stay honest
          setReactions((r) => ({ ...r, [kind]: !nextActive }));
        }
      });
    },
    [stage.reveal, wordId],
  );
  const reactionLocked = !stage.reveal;
  const heartsLabel = formatReactionCount(counts?.hearts);
  const bookmarksLabel = formatReactionCount(counts?.bookmarks);

  return (
    <article
      ref={cardRef}
      className="vocab-card"
      style={colors}
      data-theme={theme.id}
      data-stage={stage.id}
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
      <div className="vocab-progress" aria-label={`Page ${playback.page + 1} of ${stages.length}`}>
        {stages.map((item, index) => (
          <span key={item.id} data-complete={index < playback.page}>
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

      <div className="vocab-action-bar" data-no-gesture>
        <button
          type="button"
          className="vocab-reveal-button vocab-reveal-half"
          onClick={stage.reveal ? playback.restart : playback.reveal}
          aria-label={stage.reveal ? "Replay clues" : "Reveal word"}
        >
          {stage.reveal ? <RotateCcw size={16} /> : <Sparkles size={16} />}
          {stage.reveal ? "Replay" : "Ê, từ này biết nè"}
        </button>
        <div className="vocab-reaction-group">
          <div className="vocab-reaction">
            <button
              type="button"
              className="vocab-reaction-button vocab-reaction-heart"
              data-on={reactions.heart || undefined}
              disabled={reactionLocked}
              onClick={() => toggleReaction("heart")}
              aria-label={reactions.heart ? "Remove your heart from this word" : "Heart this word"}
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
        </div>
      </div>
    </article>
  );
}

/** Compact count label shown under a reaction button. */
function formatReactionCount(value: number | undefined): string {
  if (value == null) return "";
  if (value >= 1000) {
    const thousands = value / 1000;
    return `${thousands >= 10 ? Math.round(thousands) : thousands.toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(value);
}
