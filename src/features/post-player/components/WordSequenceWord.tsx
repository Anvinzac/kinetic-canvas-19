/**
 * Single animated word span for the feed WordSequenceText player.
 *
 * Exports: WordSequenceWord
 * Depends on: framer-motion, lib/canvas emphasis colors, kinetic-text emphasis, entrances, playback-timing
 */

import { motion } from "framer-motion";
import type { CSSProperties, ReactElement } from "react";
import {
  getCanvasEmphasisWordColor,
  type CanvasSpec,
} from "@/lib/canvas";
import {
  getAuraColor,
  getBoundPhraseEmphasisSeed,
  getBoundPhraseStartIndex,
  getEmphasisInnerAnimation,
  getEmphasisTextShadow,
  getEmphasisVariant,
  getWordAnchorKey,
  isDimEmphasisColor,
} from "@/features/kinetic-text";
import {
  ENTRANCE_REST,
  getEntranceHidden,
  getEntranceTransition,
  type ResolvedEntranceStyle,
} from "../lib/entrances";
import { EMPHASIS_FONT_SCALE, getWordDelay, tempoConfig } from "../lib/playback-timing";

export type WordSequenceWordProps = {
  word: string;
  index: number;
  words: string[];
  spec: CanvasSpec;
  emphasized: Set<number>;
  spotlightEmphasis: boolean;
  suppressSpotlight?: boolean;
  staticRender: boolean;
  paused: boolean;
  isSolo: boolean;
  soloInlineScale: number;
  leftAnchoredText: boolean;
  textColor: string;
  emphasisColor: string;
  entranceStyle: ResolvedEntranceStyle;
};

/**
 * @responsibility Render one kinetic word with feed entrance + emphasis styling.
 */
export function WordSequenceWord({
  word,
  index,
  words,
  spec,
  emphasized,
  spotlightEmphasis,
  suppressSpotlight = false,
  staticRender,
  paused,
  isSolo,
  soloInlineScale,
  leftAnchoredText,
  textColor,
  emphasisColor,
  entranceStyle,
}: WordSequenceWordProps): ReactElement {
  const important = emphasized.has(index);
  const spotlightWord = spotlightEmphasis && important && !suppressSpotlight;
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
  const entranceDelay = staticRender
    ? 0
    : getWordDelay(important ? emphasisAnchorIndex : index, spec.tempo, spec.rhythm);
  const tempo = tempoConfig[spec.tempo];
  const rhythmDurationMultiplier = spec.rhythm === "poetic" ? 1.28 : 1;
  const entranceDuration = staticRender
    ? 0.01
    : (important ? tempo.wordDuration * 1.22 : tempo.wordDuration) * rhythmDurationMultiplier;
  const emphasisStyle = important
    ? ({
        "--kinetic-emphasis-delay": `${entranceDelay + entranceDuration + 0.18}s`,
        ...(emphasisVariant === "halo" || emphasisVariant === "glow"
          ? { "--kinetic-aura-color": getAuraColor(textColor) }
          : {}),
      } as CSSProperties)
    : undefined;
  const innerAnimation = important
    ? staticRender
      ? undefined
      : getEmphasisInnerAnimation(emphasisVariant)
    : undefined;
  const isSoloRevealWord = isSolo;
  return (
      <motion.span
        key={`${word}-${index}`}
        data-kinetic-word={getWordAnchorKey(word)}
        data-kinetic-word-index={index}
        variants={{
          // The starting pose comes from the post's auto-picked entrance style;
          // every style settles to the shared neutral rest below. Emphasis size
          // is applied via fontSize (not scale), so settling to scale 1 keeps the
          // enlarged word from overlapping its neighbors.
          hidden: getEntranceHidden(entranceStyle, important, index),
          show: ENTRANCE_REST,
        }}
        transition={getEntranceTransition(entranceStyle, entranceDelay, entranceDuration)}
        className={important ? "relative inline-flex" : "inline-flex"}
        style={{
          color: wordColor,
          display: spotlightWord ? "inline-flex" : "inline-block",
          flexBasis: spotlightWord ? "100%" : undefined,
          justifyContent: spotlightWord ? "center" : undefined,
          textAlign: spotlightWord ? "center" : undefined,
          // Emphasized words render larger via fontSize so the extra width is
          // reserved in the flex flow (transform: scale would overlap neighbors).
          fontSize: important ? `${EMPHASIS_FONT_SCALE}em` : undefined,
          fontWeight: important ? 900 : spec.weight,
          overflowWrap: "normal",
          whiteSpace: "nowrap",
          wordBreak: "normal",
          textShadow: important
            ? getEmphasisTextShadow(emphasisVariant)
            : "0 4px 40px rgba(0,0,0,0.45)",
          animationPlayState: paused ? "paused" : "running",
          transformOrigin: leftAnchoredText && !spotlightWord ? "left center" : "center",
          // Small breathing room on top of the reserved fontSize width so the
          // bolder glyphs never kiss the adjacent words.
          marginTop: spotlightWord ? "0.08em" : undefined,
          marginBottom: spotlightWord ? "0.08em" : undefined,
          marginLeft:
            important && !spotlightWord
              ? emphasisVariant === "frame"
                ? "0.18em"
                : "0.06em"
              : undefined,
          marginRight:
            important && !spotlightWord
              ? emphasisVariant === "frame"
                ? "0.18em"
                : "0.06em"
              : undefined,
        }}
      >
        <span
          style={{
            display: "inline-block",
            transform: isSoloRevealWord ? `scaleX(${soloInlineScale})` : undefined,
            transformOrigin: "center",
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
                  }${staticRender ? "" : " is-animated"}`
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
        </span>
      </motion.span>
    );

}
