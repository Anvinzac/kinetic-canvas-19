/** One independent vocabulary learning card; no social mutations. Exports: VocabularyCard. Depends on: presets, playback, VocabularyStage. */
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { getCanvasPatternTheme, getCanvasSceneTheme } from "@/features/canvas";
import {
  PostCanvasBackdrop,
  getSlidingCanvasBackground,
  getPageDuration,
  getUniformPageTextSize,
} from "@/features/post-player";
import { RotateCcw, Sparkles } from "lucide-react";
import { buildVocabularyCanvas, choosePresentation, fitVocabularyTextSize } from "../lib/presets";
import { buildStages } from "../lib/stages";
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
  const handlePointerStart = useCallback((clientX: number, clientY: number, target: EventTarget | null) => {
    if (target instanceof HTMLElement && target.closest("button, a, input, select, textarea, [data-no-gesture]")) {
      gestureStart.current = null;
      return;
    }
    gestureStart.current = { x: clientX, y: clientY, t: Date.now() };
  }, []);
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
          hasTransitionBackground={!!sliding && !reducedMotion}
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

      <button
        type="button"
        className="vocab-reveal-button vocab-reveal-ghost"
        onClick={stage.reveal ? playback.restart : playback.reveal}
        aria-label={stage.reveal ? "Replay clues" : "Reveal word"}
        data-no-gesture
      >
        {stage.reveal ? <RotateCcw size={16} /> : <Sparkles size={16} />}
        {stage.reveal ? "Replay" : "Reveal"}
      </button>
    </article>
  );
}
