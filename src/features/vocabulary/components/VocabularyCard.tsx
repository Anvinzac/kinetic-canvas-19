/** One independent vocabulary learning card; no social mutations. Exports: VocabularyCard. Depends on: presets, playback, VocabularyStage. */
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { getCanvasPatternTheme, getCanvasSceneTheme } from "@/features/canvas";
import {
  PostCanvasBackdrop,
  getSlidingCanvasBackground,
  getPageDuration,
  getUniformPageTextSize,
} from "@/features/post-player";
import { ArrowLeft, ArrowRight, RotateCcw, Sparkles } from "lucide-react";
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
        [stage.text, stage.secondary, stage.reveal ? entry.word.defVi : ""]
          .filter(Boolean)
          .join(" "),
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
      <header className="vocab-card-heading">
        <span className="vocab-chip">{entry.word.topic}</span>
        {entry.word.level && <span className="vocab-chip">{entry.word.level}</span>}
        <span className="vocab-theme-name">
          {theme.label} / {style.label}
        </span>
      </header>
      <p className="vocab-caption">{style.caption}</p>
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
      <div className="vocab-card-actions">
        <button
          type="button"
          className="vocab-icon-button"
          onClick={playback.previous}
          disabled={playback.page === 0}
          aria-label="Previous clue"
        >
          <ArrowLeft size={20} />
        </button>
        <button
          type="button"
          className="vocab-reveal-button"
          onClick={stage.reveal ? playback.restart : playback.reveal}
        >
          {stage.reveal ? <RotateCcw size={17} /> : <Sparkles size={17} />}
          {stage.reveal ? "Replay clues" : "Reveal word"}
        </button>
        <button
          type="button"
          className="vocab-icon-button"
          onClick={playback.next}
          disabled={!!stage.reveal}
          aria-label="Next clue"
        >
          <ArrowRight size={20} />
        </button>
      </div>
      <footer className="vocab-card-footer">
        <span>
          Word {entry.position + 1} · Cycle {entry.cycle + 1}
        </span>
        <span>
          {matching === 1
            ? "One matching word"
            : `${matching.toLocaleString()} words, then reshuffle`}
        </span>
      </footer>
    </article>
  );
}
