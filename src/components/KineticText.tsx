import { motion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  getCanvasEmphasisColor,
  getCanvasTextColor,
  type CanvasSpec,
  type Rhythm,
  type Tempo,
} from "@/lib/canvas";
import { getVietnameseWordLines, isLikelyVietnameseText } from "@/lib/text-language";

const FULL_CANVAS_MAX_HEIGHT = 764;
const CANVAS_RATIO = 16 / 9;
// Same canvas-safe inset as PostCard: clear the edge without shrinking the status energy.
const TEXT_SAFE_MAX_WIDTH = "min(92%, calc(100% - 2rem))";
const MIN_TEXT_FIT_SCALE = 0.08;
const VIETNAMESE_SCALE_FIT_GUARD = 1.24;
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const tempoConfig: Record<Tempo, { duration: number; wordDelay: number; loopSeconds: number }> = {
  slow: { duration: 1.05, wordDelay: 0.2, loopSeconds: 3.4 },
  steady: { duration: 0.8, wordDelay: 0.14, loopSeconds: 2.4 },
  snappy: { duration: 0.48, wordDelay: 0.08, loopSeconds: 1.45 },
};

function entranceVariants(entrance: CanvasSpec["entrance"]) {
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

export function KineticText({
  spec,
  playKey = 0,
  paused = false,
  scaleToCanvas = false,
  background,
}: {
  spec: CanvasSpec;
  playKey?: number;
  paused?: boolean;
  scaleToCanvas?: boolean;
  background?: string | readonly string[] | null;
}) {
  const wordVariants = entranceVariants(spec.entrance);
  const words = getWords(spec.text);
  const isVietnamese = isLikelyVietnameseText(spec.text);
  const vietnameseLines = isVietnamese ? getVietnameseWordLines(words) : [];
  const emphasized = getPreviewEmphasizedWordIndexes(words);
  const layoutMode = getKineticTextLayoutMode(spec.text, isVietnamese, words.length, emphasized);
  const leftAnchoredText = layoutMode !== "center";
  const spotlightEmphasis = layoutMode === "left-spotlight";
  const tempo = tempoConfig[spec.tempo];
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [canvasScale, setCanvasScale] = useState(scaleToCanvas ? 0.4 : 1);
  const [fitScale, setFitScale] = useState(1);
  const previewSize = Math.max(10, spec.size * canvasScale * fitScale);
  const textColor = getCanvasTextColor(spec, background);
  const emphasisColor = getCanvasEmphasisColor({ ...spec, color: textColor }, background);
  const visualScaleGuard = isVietnamese ? VIETNAMESE_SCALE_FIT_GUARD : 1;

  useEffect(() => {
    if (!scaleToCanvas) {
      setCanvasScale(1);
      return;
    }

    const wrapper = wrapperRef.current;
    const canvas = wrapper?.parentElement;
    if (!canvas) return;

    function measure() {
      const previewHeight = canvas?.getBoundingClientRect().height ?? 0;
      if (!previewHeight) return;
      setCanvasScale(clamp(previewHeight / getFullCanvasHeight(), 0.2, 1));
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
    setFitScale(1);
  }, [
    canvasScale,
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

    if (nextFit < fitScale - 0.01) {
      setFitScale(Math.max(MIN_TEXT_FIT_SCALE, nextFit));
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

  return (
    <div
      ref={wrapperRef}
      className="absolute pointer-events-none select-none"
      style={{
        left: `${spec.x}%`,
        top: `${spec.y}%`,
        transform: "translate(-50%, -50%)",
        width: TEXT_SAFE_MAX_WIDTH,
        maxWidth: TEXT_SAFE_MAX_WIDTH,
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
          animation: getLoopAnimation(spec.loop, spec.tempo),
          animationPlayState: paused ? "paused" : "running",
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
                  flexWrap: "wrap",
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
) {
  return (
    <motion.span
      key={`${playKey}-${word}-${index}`}
      initial={wordVariants.initial}
      animate={wordVariants.animate}
      transition={{
        delay: getRhythmDelay(index, spec.tempo, spec.rhythm),
        duration: Math.max(0.28, tempo.duration * 0.62),
        ease: [0.22, 1, 0.36, 1],
      }}
      style={{
        display: spotlightWord ? "inline-flex" : "inline-block",
        flexBasis: spotlightWord ? "100%" : undefined,
        justifyContent: spotlightWord ? "center" : undefined,
        marginBottom: spotlightWord ? "0.08em" : undefined,
        marginTop: spotlightWord ? "0.08em" : undefined,
        textAlign: spotlightWord ? "center" : undefined,
        color: important ? emphasisColor : textColor,
        fontWeight: important ? 900 : spec.weight,
        overflowWrap: "normal",
        whiteSpace: "nowrap",
        wordBreak: "normal",
        animationPlayState: paused ? "paused" : "running",
        transformOrigin: anchorFromStart && !spotlightWord ? "left center" : "center",
      }}
    >
      {word}
    </motion.span>
  );
}

function getLoopAnimation(loop: CanvasSpec["loop"], tempo: Tempo) {
  if (loop === "none") return undefined;
  return `kinetic-${loop} ${tempoConfig[tempo].loopSeconds}s ease-in-out infinite`;
}

function getRhythmDelay(index: number, tempo: Tempo, rhythm: Rhythm) {
  const base = tempoConfig[tempo].wordDelay;
  if (rhythm === "smooth") return index * base * 0.8;
  if (rhythm === "burst") return index * base * 0.7;
  return index * base;
}

function getWords(text: string) {
  return text.match(/\S+/g) ?? [];
}

function getFullCanvasHeight() {
  if (typeof window === "undefined") return FULL_CANVAS_MAX_HEIGHT;
  return Math.min(window.innerHeight, FULL_CANVAS_MAX_HEIGHT, window.innerWidth * CANVAS_RATIO);
}

function getMeasuredTextWidth(text: HTMLElement, wrapper: HTMLElement, leftAnchored: boolean) {
  if (!leftAnchored) return text.scrollWidth;

  const wrapperLeft = wrapper.getBoundingClientRect().left;
  const rightEdge = Array.from(text.querySelectorAll("span")).reduce((maxRight, element) => {
    return Math.max(maxRight, element.getBoundingClientRect().right - wrapperLeft);
  }, 0);

  return rightEdge || text.scrollWidth;
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

function getPreviewEmphasizedWordIndexes(words: string[]) {
  const candidates = words
    .map((word, index) => ({
      index,
      score: getPreviewWordImportance(word, index, words.length),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const selected = candidates.slice(0, Math.min(2, Math.max(1, Math.ceil(words.length / 4))));
  if (selected.length === 0 && words.length > 0) return new Set([words.length - 1]);
  return new Set(selected.map((item) => item.index));
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

function getStableNumber(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
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
