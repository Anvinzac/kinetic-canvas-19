/**
 * Animated word span for KineticText preview (entrance + emphasis mark).
 *
 * Exports: AnimatedWord
 * Depends on: framer-motion, canvas colors, kinetic emphasis/words/text-language
 */

import { motion } from "framer-motion";
import type { CSSProperties, ReactElement} from "react";
import {
  getCanvasEmphasisWordColor,
  type CanvasSpec,
} from "@/features/canvas";
import {
  getAuraColor,
  getEmphasisInnerAnimation,
  getEmphasisTextShadow,
  getEmphasisVariant,
  isDimEmphasisColor,
} from "../lib/emphasis";
import {
  getBoundPhraseEmphasisSeed,
  getBoundPhraseStartIndex,
} from "../lib/text-language";
import { getWordAnchorKey } from "../lib/words";
import { entranceVariants, getRhythmDelay } from "./preview-tempo";

/**
 * Render the AnimatedWord UI.
 * @param props - Component props
 * @returns Rendered UI
 */
export function AnimatedWord({
  word,
  index,
  playKey,
  wordVariants,
  spec,
  tempo,
  paused,
  anchorFromStart,
  spotlightWord,
  important,
  textColor,
  emphasisColor,
  staticLayout,
  words,
}: {
  word: string;
  index: number;
  playKey: number;
  wordVariants: ReturnType<typeof entranceVariants>;
  spec: CanvasSpec;
  tempo: { duration: number };
  paused: boolean;
  anchorFromStart: boolean;
  spotlightWord: boolean;
  important: boolean;
  textColor: string;
  emphasisColor: string;
  staticLayout: boolean;
  words: string[];
}): ReactElement {
  const emphasisAnchorIndex = important ? getBoundPhraseStartIndex(words, index): index;
  const emphasisVariant = important
    ? getEmphasisVariant(
        spec.text,
        getBoundPhraseEmphasisSeed(words, index),
        emphasisAnchorIndex,
        !isDimEmphasisColor(emphasisColor),
      ): null;
  const wordColor = important
    ? getCanvasEmphasisWordColor(emphasisVariant, textColor, emphasisColor): textColor;
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
      } as CSSProperties): undefined;
  const innerAnimation =
    important && !staticLayout ? getEmphasisInnerAnimation(emphasisVariant): undefined;
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
        textShadow: important ? getEmphasisTextShadow(emphasisVariant): undefined,
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
