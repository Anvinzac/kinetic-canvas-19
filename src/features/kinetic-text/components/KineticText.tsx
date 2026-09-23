/**
 * Animated kinetic typography overlay for create/preview canvases.
 *
 * Exports: KineticText
 * Depends on: framer-motion, canvas colors, kinetic layout/loop/text-language, WordRenderer
 */

import type { ReactElement } from "react";
import { motion } from "framer-motion";
import { getCanvasEmphasisColor, getCanvasTextColor, type CanvasSpec } from "@/features/canvas";
import { getKineticTextLayoutMode, hasVisibleStickerAccent } from "../lib/layout";
import { getLoopAnimation } from "../lib/loop";
import { isLikelyVietnameseText } from "../lib/text-language";
import { getWords } from "../lib/words";
import { VietnameseLineBlock } from "./VietnameseLineBlock";
import { AnimatedWord } from "./WordRenderer";
import { getPreviewEmphasizedWordIndexes } from "./preview-emphasis";
import { TEXT_SAFE_MAX_WIDTH, VIETNAMESE_SCALE_FIT_GUARD } from "./preview-fit";
import { entranceVariants, tempoConfig } from "./preview-tempo";
import { useKineticTextFit } from "./useKineticTextFit";

/**
 * Group consecutive emphasized word indices into [start, end) ranges.
 * @param words - words argument
 * @param emphasized - emphasized argument
 * @returns Array of non-overlapping ranges covering consecutive emphasized runs
 */
function getEmphasisGroups(
  words: string[],
  emphasized: Set<number>,
): Array<{ start: number; end: number }> {
  const groups: Array<{ start: number; end: number }> = [];
  let i = 0;

  while (i < words.length) {
    if (!emphasized.has(i)) {
      i += 1;
      continue;
    }

    const start = i;
    while (i < words.length && emphasized.has(i)) {
      i += 1;
    }

    if (i - start >= 2) {
      groups.push({ start, end: i });
    }
  }

  return groups;
}

/**
 * Animated kinetic typography overlay for create/preview canvases.
 * @param props - Component props
 * @returns Absolutely positioned word sequence with entrance + idle loop
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
}): ReactElement {
  const wordVariants = entranceVariants(spec.entrance, spec.rhythm);
  const words = getWords(spec.text);
  const isVietnamese = isLikelyVietnameseText(spec.text);
  const emphasized = getPreviewEmphasizedWordIndexes(words);
  const visualScaleGuard = isVietnamese ? VIETNAMESE_SCALE_FIT_GUARD : 1;
  const layoutMode = getKineticTextLayoutMode(spec.text, isVietnamese, words.length, emphasized);
  const leftAnchoredText = layoutMode !== "center";
  const spotlightEmphasis = layoutMode === "left-spotlight";
  const tempo = tempoConfig[spec.tempo];
  const { wrapperRef, textRef, previewSize, vietnameseLines } = useKineticTextFit({
    scaleToCanvas,
    isVietnamese,
    words,
    visualScaleGuard,
    leftAnchoredText,
    spec,
  });
  const textColor = getCanvasTextColor(spec, background);
  const emphasisColor = getCanvasEmphasisColor({ ...spec, color: textColor }, background);
  const textSafeMaxWidth = hasVisibleStickerAccent(spec.stickers, spec.text)
    ? "min(90%, calc(100% - 2.5rem))"
    : TEXT_SAFE_MAX_WIDTH;
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
        {isVietnamese ? (
          <VietnameseLineBlock
            lines={vietnameseLines}
            playKey={playKey}
            wordVariants={wordVariants}
            spec={spec}
            tempo={tempo}
            paused={paused}
            emphasized={emphasized}
            textColor={textColor}
            emphasisColor={emphasisColor}
            staticLayout={staticLayout}
            words={words}
          />
        ) : (
          (() => {
            const groups = getEmphasisGroups(words, emphasized);
            const groupSet = new Set<number>();
            for (const g of groups) {
              for (let i = g.start; i < g.end; i++) groupSet.add(i);
            }

            return words.map((word, i) => {
              if (!groupSet.has(i))
                return (
                  <AnimatedWord
                    key={`${playKey}-${word}-${i}`}
                    word={word}
                    index={i}
                    playKey={playKey}
                    wordVariants={wordVariants}
                    spec={spec}
                    tempo={tempo}
                    paused={paused}
                    anchorFromStart={leftAnchoredText}
                    spotlightWord={spotlightEmphasis && emphasized.has(i)}
                    important={emphasized.has(i)}
                    textColor={textColor}
                    emphasisColor={emphasisColor}
                    staticLayout={staticLayout}
                    words={words}
                  />
                );

              const grp = groups.find((g) => i >= g.start && i < g.end);
              if (!grp || grp.start !== i) return null;

              return (
                <span
                  key={`frame-group-${i}`}
                  className="kinetic-emphasis-mark kinetic-emph-frame inline-flex relative"
                  style={{
                    display: "inline-flex",
                    flex: "0 0 auto",
                    alignItems: "baseline",
                    columnGap: "0.24em",
                    padding: "0.05em 0.3em 0.1em",
                    borderRadius: "0.28em",
                    border: "0.05em solid transparent",
                    isolation: "isolate",
                    marginLeft: "-0.02em",
                    marginRight: "-0.02em",
                  }}
                >
                  {words.slice(grp.start, grp.end).map((w, wi) => (
                    <AnimatedWord
                      key={`${playKey}-${w}-${grp.start + wi}`}
                      word={w}
                      index={grp.start + wi}
                      playKey={playKey}
                      wordVariants={wordVariants}
                      spec={spec}
                      tempo={tempo}
                      paused={paused}
                      anchorFromStart={leftAnchoredText}
                      spotlightWord={false}
                      important
                      skipFrame
                      textColor={textColor}
                      emphasisColor={emphasisColor}
                      staticLayout={staticLayout}
                      words={words}
                    />
                  ))}
                </span>
              );
            });
          })()
        )}
      </motion.div>
    </div>
  );
}
