/**
 * Animated word span for KineticText preview (entrance + emphasis mark).
 *
 * Exports: AnimatedWord
 * Depends on: framer-motion, canvas colors, kinetic emphasis/words/text-language
 */

import { motion } from "framer-motion";
import type { CSSProperties, ReactElement } from "react";
import { getCanvasEmphasisWordColor, type CanvasSpec } from "@/features/canvas";
import {
  getAuraColor,
  getEmphasisInnerAnimation,
  getEmphasisTextShadow,
  getEmphasisVariant,
  isDimEmphasisColor,
  type EmphasisVariant,
} from "../lib/emphasis";
import { getBoundPhraseEmphasisSeed, getBoundPhraseStartIndex } from "../lib/text-language";
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
  spotlightWord: spotlightProp,
  important: importantProp,
  textColor,
  emphasisColor,
  staticLayout,
  words,
  skipFrame = false,
  phraseKeys,
  sharedVariant,
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
  skipFrame?: boolean;
  /** Bound phrase keys — the curated list plus every highlighted run — for shared styling. */
  phraseKeys?: readonly (readonly string[])[];
  /**
   * The effect the group this word belongs in was dressed in. Handed down rather than
   * re-hashed per syllable, because a syllable seeds only from a phrase list; a compound
   * missing from it would otherwise give each half a different effect.
   */
  sharedVariant?: EmphasisVariant;
}): ReactElement {
  // Mirror the feed renderer (WordSequenceWord): a token with no letter/number —
  // trailing punctuation, or a masked "_____" answer blank (underscore is \p{Pc},
  // not \p{L}/\p{N}) — can still arrive marked important. Framing it draws an empty
  // rounded rect, and spotlighting it centers a full-width box around nothing, so a
  // glyph-less token is never treated as emphasized or spotlighted here.
  const hasGlyph = /\p{L}|\p{N}/u.test(word);
  const important = importantProp && hasGlyph;
  const spotlightWord = spotlightProp && hasGlyph;
  const emphasisAnchorIndex = important
    ? getBoundPhraseStartIndex(words, index, phraseKeys)
    : index;
  const emphasisVariant = important
    ? (sharedVariant ??
      getEmphasisVariant(
        spec.text,
        getBoundPhraseEmphasisSeed(words, index, phraseKeys),
        emphasisAnchorIndex,
        !isDimEmphasisColor(emphasisColor),
      ))
    : null;
  // A shared multi-syllable run must not render as a big boxed container: when a
  // syllable sits inside a group (skipFrame) and the seeded effect is the box-drawing
  // `frame`, downgrade it to a continuous underline so the phrase reads as highlighted
  // text instead. A lone `frame` word (skipFrame false) keeps its box.
  const displayVariant = skipFrame && emphasisVariant === "frame" ? "underline" : emphasisVariant;
  const wordColor = important
    ? getCanvasEmphasisWordColor(displayVariant, textColor, emphasisColor)
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
        ...(displayVariant === "halo" || displayVariant === "glow"
          ? { "--kinetic-aura-color": getAuraColor(textColor) }
          : {}),
      } as CSSProperties)
    : undefined;
  const innerAnimation =
    important && !staticLayout ? getEmphasisInnerAnimation(displayVariant) : undefined;
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
        flexShrink: 0,
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
        textShadow: important ? getEmphasisTextShadow(displayVariant) : undefined,
        transformOrigin: anchorFromStart && !spotlightWord ? "left center" : "center",
      }}
    >
      <span
        className={
          important
            ? `kinetic-emphasis-mark${
                displayVariant === "halo"
                  ? " kinetic-emph-halo"
                  : displayVariant === "frame"
                    ? // Only a lone word reaches here — a grouped `frame` was already
                      // downgraded to `underline` via displayVariant above.
                      " kinetic-emph-frame"
                    : displayVariant === "underline"
                      ? // A syllable inside a shared run joins its bar across the column
                        // gap, so a compound never shows an underline broken mid-word.
                        skipFrame
                        ? " kinetic-emph-underline is-joined"
                        : " kinetic-emph-underline"
                      : displayVariant === "sweep"
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
