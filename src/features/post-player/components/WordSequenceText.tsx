/**
 * Paginated kinetic word sequence for the feed post player.
 *
 * Exports: WordSequenceText
 * Depends on: framer-motion, canvas colors, kinetic-text layout, feed-emphasis, entrances, playback-timing, WordSequenceLines, useWordSequenceFit
 */

import { motion } from "framer-motion";
import { useMemo, useRef, type ReactElement } from "react";
import {
  getCanvasEmphasisColor,
  getCanvasTextColor,
  getPhotoBackdropTextShadow,
  resolveTextColorOnPhotoBackdrop,
  type CanvasSpec,
} from "@/lib/canvas";
import {
  getKineticTextLayoutMode,
  getLoopAnimation,
  getVietnameseLayoutMetrics,
  getWords,
  hasVisibleStickerAccent,
  isLikelyVietnameseText,
} from "@/features/kinetic-text";
import { getEmphasizedWordIndexes } from "../lib/feed-emphasis";
import { getEntranceStyle } from "../lib/entrances";
import {
  EMPHASIS_FONT_SCALE,
  EMPHASIS_SCALE_FIT_GUARD,
  TEXT_SAFE_MAX_WIDTH,
  VIETNAMESE_SCALE_FIT_GUARD,
  estimateSoloRevealFit,
} from "../lib/playback-timing";
import { useWordSequenceFit } from "../hooks/useWordSequenceFit";
import { WordSequenceLines } from "./WordSequenceLines";

export type WordSequenceTextProps = {
  spec: CanvasSpec;
  playKey: number;
  paused: boolean;
  revealed: boolean;
  canvasWidth: number;
  measure?: boolean;
  onFitScale?: (scale: number) => void;
  disableFit?: boolean;
  background?: string | null;
  photoBackdrop?: boolean;
  entranceSeed?: string;
};

/**
 * Render fitted kinetic words for one post text page.
 * @param props - WordSequenceTextProps fields
 * @returns Rendered UI
 */
export function WordSequenceText({
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
}: WordSequenceTextProps): ReactElement {
  const words = getWords(spec.text);
  const isVietnamese = isLikelyVietnameseText(spec.text);
  const emphasized = getEmphasizedWordIndexes(words);
  const isSolo = words.length <= 1;
  const visualScaleGuard = Math.max(
    emphasized.size > 0 && !isSolo ? EMPHASIS_SCALE_FIT_GUARD : 1,
    isVietnamese ? VIETNAMESE_SCALE_FIT_GUARD : 1,
  );
  const vietnameseLayout = useMemo(
    () =>
      isVietnamese
        ? getVietnameseLayoutMetrics(words, canvasWidth, spec.size, visualScaleGuard): { lines: [], suggestedFitScale: 1 },
    [isVietnamese, words, canvasWidth, spec.size, visualScaleGuard],
  );
  const entranceStyle = getEntranceStyle(entranceSeed ?? spec.text, spec.rhythm);
  const layoutMode = getKineticTextLayoutMode(spec.text, isVietnamese, words.length, emphasized);
  const leftAnchoredText = layoutMode !== "center";
  const spotlightEmphasis = layoutMode === "left-spotlight";
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
        ): 1;
  const initialFit =
    isSolo
      ? soloInitialFit
      : isVietnamese && !disableFit
        ? vietnameseLayout.suggestedFitScale
        : 1;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const staticRender = revealed || measure;
  const { fontSize, soloInlineScale, safeCenterY } = useWordSequenceFit({
    initialFit,
    canvasWidth,
    background,
    spec,
    disableFit,
    onFitScale,
    isSolo,
    isVietnamese,
    leftAnchoredText,
    visualScaleGuard,
    wrapperRef,
    textRef,
  });
  const textColor = photoBackdrop
    ? resolveTextColorOnPhotoBackdrop(spec): getCanvasTextColor(spec, background);
  const emphasisColor = getCanvasEmphasisColor({ ...spec, color: textColor }, background);
  const photoTextShadow = photoBackdrop ? getPhotoBackdropTextShadow(textColor): undefined;
  const textSafeMaxWidth = hasVisibleStickerAccent(spec.stickers, spec.text)
    ? "min(90%, calc(100% - 2.5rem))"
    : TEXT_SAFE_MAX_WIDTH;
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
        <WordSequenceLines
          isVietnamese={isVietnamese}
          vietnameseLines={vietnameseLayout.lines}
          words={words}
          emphasized={emphasized}
          spotlightEmphasis={spotlightEmphasis}
          spec={spec}
          staticRender={staticRender}
          paused={paused}
          isSolo={isSolo}
          soloInlineScale={soloInlineScale}
          leftAnchoredText={leftAnchoredText}
          textColor={textColor}
          emphasisColor={emphasisColor}
          entranceStyle={entranceStyle}
        />
      </motion.div>
    </div>
  );
}
