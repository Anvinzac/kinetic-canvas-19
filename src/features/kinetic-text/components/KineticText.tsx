import { motion } from "framer-motion";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  getCanvasEmphasisColor,
  getCanvasEmphasisWordColor,
  getCanvasTextColor,
  type CanvasSpec,
  type Rhythm,
  type Tempo,
} from "@/features/canvas";
import {
  getAuraColor,
  getEmphasisInnerAnimation,
  getEmphasisTextShadow,
  getEmphasisVariant,
  isDimEmphasisColor,
} from "../lib/emphasis";
import {
  getKineticTextLayoutMode,
  getMeasuredTextWidth,
  hasVisibleStickerAccent,
} from "../lib/layout";
import { getLoopAnimation } from "../lib/loop";
import {
  getSpecialPoeticWordIndexes,
  getVietnameseLayoutMetrics,
  isLikelyVietnameseText,
  expandEmphasisToBoundPhrases,
  getBoundPhraseEmphasisSeed,
  getBoundPhraseStartIndex,
} from "../lib/text-language";
import { getWordAnchorKey, getWords } from "../lib/words";

const FULL_CANVAS_MAX_HEIGHT = 764;
const FULL_CANVAS_REFERENCE_WIDTH = FULL_CANVAS_MAX_HEIGHT * (9 / 16);
// Same canvas-safe inset as PostCard: clear the edge without shrinking the status energy.
const TEXT_SAFE_MAX_WIDTH = "min(92%, calc(100% - 2rem))";
const MIN_TEXT_FIT_SCALE = 0.46;
const VIETNAMESE_SCALE_FIT_GUARD = 1.24;
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

// Preview tempo shape — diverges from PostCard's tempoConfig (which adds
// pageMultiplier / wordDuration and uses different wordDelay values).
// loopSeconds match TEMPO_LOOP_SECONDS in ../lib/loop (used by getLoopAnimation).
const tempoConfig: Record<Tempo, { duration: number; wordDelay: number; loopSeconds: number }> = {
  slow: { duration: 1.05, wordDelay: 0.2, loopSeconds: 3.4 },
  steady: { duration: 0.8, wordDelay: 0.14, loopSeconds: 2.4 },
  snappy: { duration: 0.48, wordDelay: 0.08, loopSeconds: 1.45 },
};

// Preview-only entrance variants keyed by CanvasSpec.entrance.
// PostCard uses a separate ENTRANCE_STYLES personality system — do not unify.
function entranceVariants(entrance: CanvasSpec["entrance"], rhythm?: Rhythm) {
  if (rhythm === "poetic") {
    return {
      initial: { opacity: 0, y: 12, scale: 1.05, filter: "blur(18px)" },
      animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
    };
  }

  switch (entrance) {
    case "fade":
      return { initial: { opacity: 0 }, animate: { opacity: 1 } };
    case "slide":
      return { initial: { opacity: 0, y: 40 }, animate: { opacity: 1, y: 0 } };
    case "scale":
      return { initial: { opacity: 0, scale: 0.3 }, animate: { opacity: 1, scale: 1 } };
    case "blur":
      return {
        initial: { opacity: 0, filter: "blur(24px)" },
        animate: { opacity: 1, filter: "blur(0px)" },
      };
    case "split":
      return { initial: { opacity: 0, y: 40 }, animate: { opacity: 1, y: 0 } };
  }
}

/**
 * @responsibility Animated kinetic typography overlay for create/preview canvases.
 * @inputs CanvasSpec plus playback/layout flags (playKey, paused, scaleToCanvas, staticLayout, background)
 * @outputs Absolutely positioned word sequence with entrance + idle loop
 * @pure false
 */
export function KineticText({
  spec,
  playKey = 0,
  paused = false,
  scaleToCanvas = false,
  staticLayout = false,
  background,
}: {
  spec: CanvasSpec;
  playKey?: number;
  paused?: boolean;
  scaleToCanvas?: boolean;
  staticLayout?: boolean;
  background?: string | readonly string[] | null;
}) {
  const wordVariants = entranceVariants(spec.entrance, spec.rhythm);
  const words = getWords(spec.text);
  const isVietnamese = isLikelyVietnameseText(spec.text);
  const emphasized = getPreviewEmphasizedWordIndexes(words);
  const visualScaleGuard = isVietnamese ? VIETNAMESE_SCALE_FIT_GUARD : 1;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [canvasScale, setCanvasScale] = useState(scaleToCanvas ? 0.4 : 1);
  const [canvasWidth, setCanvasWidth] = useState(FULL_CANVAS_REFERENCE_WIDTH);
  const vietnameseLayout = useMemo(
    () =>
      isVietnamese
        ? getVietnameseLayoutMetrics(
            words,
            canvasWidth,
            spec.size * canvasScale,
            visualScaleGuard,
          )
        : { lines: [], suggestedFitScale: 1 },
    [isVietnamese, words, canvasWidth, spec.size, canvasScale, visualScaleGuard],
  );
  const vietnameseLines = isVietnamese ? vietnameseLayout.lines : [];
  const layoutMode = getKineticTextLayoutMode(spec.text, isVietnamese, words.length, emphasized);
  const leftAnchoredText = layoutMode !== "center";
  const spotlightEmphasis = layoutMode === "left-spotlight";
  const tempo = tempoConfig[spec.tempo];
  const [fitScale, setFitScale] = useState(
    isVietnamese ? vietnameseLayout.suggestedFitScale : 1,
  );
  const previewSize = Math.max(10, spec.size * canvasScale * fitScale);
  const textColor = getCanvasTextColor(spec, background);
  const emphasisColor = getCanvasEmphasisColor({ ...spec, color: textColor }, background);
  const textSafeMaxWidth = hasVisibleStickerAccent(spec.stickers, spec.text)
    ? "min(90%, calc(100% - 2.5rem))"
    : TEXT_SAFE_MAX_WIDTH;

  useEffect(() => {
    if (!scaleToCanvas) {
      setCanvasScale(1);
      return;
    }

    const wrapper = wrapperRef.current;
    const canvas = wrapper?.parentElement;
    if (!canvas) return;

    function measure() {
      const rect = canvas?.getBoundingClientRect();
      if (!rect?.width || !rect?.height) return;
      setCanvasWidth(rect.width);
      const heightScale = rect.height / FULL_CANVAS_MAX_HEIGHT;
      const widthScale = rect.width / FULL_CANVAS_REFERENCE_WIDTH;
      setCanvasScale(clamp(Math.min(heightScale, widthScale), 0.2, 1));
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [scaleToCanvas]);

  useIsomorphicLayoutEffect(() => {
    setFitScale(isVietnamese ? vietnameseLayout.suggestedFitScale : 1);
  }, [
    canvasScale,
    canvasWidth,
    isVietnamese,
    vietnameseLayout.suggestedFitScale,
    spec.text,
    spec.size,
    spec.font,
    spec.weight,
    spec.letterSpacing,
    spec.entrance,
    spec.x,
    spec.y,
  ]);

  useIsomorphicLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const text = textRef.current;
    const canvas = wrapper?.parentElement;
    if (!wrapper || !text || !canvas) return;

    const canvasHeight = canvas.getBoundingClientRect().height;
    const wrapperWidth = wrapper.getBoundingClientRect().width;
    if (!canvasHeight || !wrapperWidth) return;

    const verticalRoom = (canvasHeight * Math.min(spec.y, 100 - spec.y) * 2) / 100;
    const maxHeight = Math.max(canvasHeight * 0.3, verticalRoom * 0.9);
    const measuredWidth = getMeasuredTextWidth(text, wrapper, leftAnchoredText);
    const widthRatio = wrapperWidth / Math.max(measuredWidth * visualScaleGuard, 1);
    const heightRatio = maxHeight / Math.max(text.scrollHeight, 1);
    const nextFit = Math.min(1, fitScale * Math.min(widthRatio, heightRatio) * 0.98);
    const fitFloor = getPreviewFitFloor(spec.text);

    if (nextFit < fitScale - 0.01) {
      setFitScale(Math.max(fitFloor, nextFit));
    }
  }, [
    fitScale,
    previewSize,
    spec.text,
    spec.font,
    spec.weight,
    spec.letterSpacing,
    spec.entrance,
    spec.y,
    isVietnamese,
    leftAnchoredText,
    visualScaleGuard,
  ]);

  const loopAnimation = staticLayout ? undefined : getLoopAnimation(spec.loop, spec.tempo);

  return (
    <div
      ref={wrapperRef}
      className="absolute pointer-events-none select-none"
      style={{
        left: `${spec.x}%`,
        top: `${spec.y}%`,
        transform: "translate(-50%, -50%)",
        width: textSafeMaxWidth,
        maxWidth: textSafeMaxWidth,
      }}
    >
      <motion.div
        ref={textRef}
        key={playKey}
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        style={{
          width: "100%",
          fontFamily: spec.font,
          fontSize: previewSize,
          color: textColor,
          fontWeight: spec.weight,
          letterSpacing: `${spec.letterSpacing}em`,
          transform: `rotate(${spec.rotation}deg)`,
          lineHeight: isVietnamese ? 1.06 : 0.95,
          textAlign: leftAnchoredText ? "left" : "center",
          textShadow: "0 4px 40px rgba(0,0,0,0.45)",
          animation: loopAnimation
            ? `${loopAnimation} ${paused ? "paused" : "running"}`
            : undefined,
          whiteSpace: "normal",
          wordBreak: "normal",
          overflowWrap: "normal",
          display: "flex",
          flexDirection: isVietnamese ? "column" : undefined,
          flexWrap: isVietnamese ? "nowrap" : "wrap",
          alignItems: isVietnamese ? "stretch" : leftAnchoredText ? "baseline" : "center",
          justifyContent: leftAnchoredText ? "flex-start" : "center",
          columnGap: isVietnamese ? undefined : "0.34em",
          rowGap: isVietnamese ? undefined : "0.1em",
        }}
      >
        {isVietnamese
          ? vietnameseLines.map((line, lineIndex) => (
              <div
                key={`${lineIndex}-${line.indentEm}`}
                style={{
                  alignSelf: "stretch",
                  boxSizing: "border-box",
                  display: "flex",
                  flexWrap: "nowrap",
                  justifyContent: "flex-start",
                  columnGap: "0.24em",
                  rowGap: "0.1em",
                  marginTop: lineIndex === 0 ? 0 : "0.08em",
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
                      style={{
                        alignItems: "baseline",
                        columnGap: "0.24em",
                        display: "inline-flex",
                        flexBasis: spotlightSegment ? "100%" : undefined,
                        flexWrap: "nowrap",
                        justifyContent: spotlightSegment ? "center" : undefined,
                        marginBottom: spotlightSegment ? "0.08em" : undefined,
                        marginTop: spotlightSegment ? "0.08em" : undefined,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {segment.words.map(({ text, index }) =>
                        renderAnimatedWord(
                          text,
                          index,
                          playKey,
                          wordVariants,
                          spec,
                          tempo,
                          paused,
                          true,
                          false,
                          emphasized.has(index),
                          textColor,
                          emphasisColor,
                          staticLayout,
                          words,
                        ),
                      )}
                    </span>
                  );
                })}
              </div>
            ))
          : words.map((word, i) =>
              renderAnimatedWord(
                word,
                i,
                playKey,
                wordVariants,
                spec,
                tempo,
                paused,
                leftAnchoredText,
                spotlightEmphasis && emphasized.has(i),
                emphasized.has(i),
                textColor,
                emphasisColor,
                staticLayout,
                words,
              ),
            )}
      </motion.div>
    </div>
  );
}

function renderAnimatedWord(
  word: string,
  index: number,
  playKey: number,
  wordVariants: ReturnType<typeof entranceVariants>,
  spec: CanvasSpec,
  tempo: { duration: number },
  paused: boolean,
  anchorFromStart: boolean,
  spotlightWord: boolean,
  important: boolean,
  textColor: string,
  emphasisColor: string,
  staticLayout: boolean,
  words: string[],
) {
  const emphasisAnchorIndex = important ? getBoundPhraseStartIndex(words, index) : index;
  const emphasisVariant = important
    ? getEmphasisVariant(
        spec.text,
        getBoundPhraseEmphasisSeed(words, index),
        emphasisAnchorIndex,
        !isDimEmphasisColor(emphasisColor),
      )
    : null;
  const wordColor = important
    ? getCanvasEmphasisWordColor(emphasisVariant, textColor, emphasisColor)
    : textColor;
  const entranceDelay = getRhythmDelay(
    important ? emphasisAnchorIndex : index,
    spec.tempo,
    spec.rhythm,
  );
  const rhythmDurationMultiplier = spec.rhythm === "poetic" ? 1.28 : 1;
  const entranceDuration = Math.max(0.28, tempo.duration * 0.62 * rhythmDurationMultiplier);
  const emphasisStyle = important
    ? ({
        "--kinetic-emphasis-delay": `${entranceDelay + entranceDuration + 0.18}s`,
        ...(emphasisVariant === "halo" || emphasisVariant === "glow"
          ? { "--kinetic-aura-color": getAuraColor(textColor) }
          : {}),
      } as CSSProperties)
    : undefined;
  const innerAnimation =
    important && !staticLayout ? getEmphasisInnerAnimation(emphasisVariant) : undefined;
  return (
    <motion.span
      key={`${playKey}-${word}-${index}`}
      data-kinetic-word={getWordAnchorKey(word)}
      data-kinetic-word-index={index}
      initial={staticLayout ? false : wordVariants.initial}
      animate={
        staticLayout ? { opacity: 1, y: 0, x: 0, scale: 1, rotate: 0 } : wordVariants.animate
      }
      transition={{
        delay: staticLayout ? 0 : entranceDelay,
        duration: staticLayout
          ? 0.01
          : spec.rhythm === "poetic"
            ? entranceDuration * 1.42
            : entranceDuration,
        ease: spec.rhythm === "poetic" ? [0.16, 1, 0.3, 1] : [0.22, 1, 0.36, 1],
      }}
      style={{
        display: spotlightWord ? "inline-flex" : "inline-block",
        flexBasis: spotlightWord ? "100%" : undefined,
        justifyContent: spotlightWord ? "center" : undefined,
        marginBottom: spotlightWord ? "0.08em" : undefined,
        marginTop: spotlightWord ? "0.08em" : undefined,
        textAlign: spotlightWord ? "center" : undefined,
        color: wordColor,
        fontWeight: important ? 900 : spec.weight,
        fontSize: important ? "1.08em" : undefined,
        overflowWrap: "normal",
        whiteSpace: "nowrap",
        wordBreak: "normal",
        textShadow: important ? getEmphasisTextShadow(emphasisVariant) : undefined,
        transformOrigin: anchorFromStart && !spotlightWord ? "left center" : "center",
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
              }${paused || staticLayout ? "" : " is-animated"}`
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
    </motion.span>
  );
}

// Preview rhythm delays — multipliers differ from PostCard getWordDelay (smooth/burst).
function getRhythmDelay(index: number, tempo: Tempo, rhythm: Rhythm) {
  const base = tempoConfig[tempo].wordDelay;
  if (rhythm === "poetic") return index * base * 1.45;
  if (rhythm === "smooth") return index * base * 0.8;
  if (rhythm === "burst") return index * base * 0.7;
  return index * base;
}

function getPreviewFitFloor(text: string) {
  const words = getWords(text).length;
  if (words <= 8) return 0.74;
  if (words <= 14) return 0.62;
  if (words <= 22) return 0.52;
  return MIN_TEXT_FIT_SCALE;
}

// Preview emphasis scoring — narrower word list / no digit-or-ALLCAPS bonuses.
// PostCard getEmphasizedWordIndexes + getWordImportance diverge; do not unify.
function getPreviewEmphasizedWordIndexes(words: string[]) {
  const poeticIndexes = getSpecialPoeticWordIndexes(words);
  if (poeticIndexes.size > 0) return poeticIndexes;

  const candidates = words
    .map((word, index) => ({
      index,
      score: getPreviewWordImportance(word, index, words.length),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const selected = candidates.slice(0, Math.min(2, Math.max(1, Math.ceil(words.length / 4))));
  if (selected.length === 0 && words.length > 0) {
    return expandEmphasisToBoundPhrases(words, [words.length - 1]);
  }
  return expandEmphasisToBoundPhrases(
    words,
    selected.map((item) => item.index),
  );
}

function getPreviewWordImportance(word: string, index: number, total: number) {
  const cleaned = word.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
  if (!cleaned || PREVIEW_STOP_WORDS.has(cleaned)) return 0;

  let score = 0;
  if (PREVIEW_EMPHASIS_WORDS.has(cleaned)) score += 4;
  if (cleaned.length >= 8) score += 3;
  else if (cleaned.length >= 6) score += 2;
  if (index === total - 1 && cleaned.length > 3) score += 2;
  return score;
}

const PREVIEW_STOP_WORDS = new Set([
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

const PREVIEW_EMPHASIS_WORDS = new Set([
  "breathe",
  "first",
  "frame",
  "glowing",
  "idea",
  "important",
  "motion",
  "pause",
  "replay",
  "rhythm",
  "sentence",
  "spark",
  "surprise",
  "timing",
]);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
