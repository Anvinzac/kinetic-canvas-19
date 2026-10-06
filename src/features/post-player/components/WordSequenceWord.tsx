/**
 * Single animated word span for the feed WordSequenceText player.
 *
 * Exports: WordSequenceWord
 * Depends on: framer-motion, lib/canvas emphasis colors, kinetic-text emphasis, entrances, playback-timing
 */

import { motion } from "framer-motion";
import type { CSSProperties, ReactElement } from "react";
import { getCanvasEmphasisWordColor, type CanvasSpec } from "@/features/canvas";
import {
  getAuraColor,
  getBoundPhraseStartIndex,
  getEmphasisInnerAnimation,
  getEmphasisTextShadow,
  getWordAnchorKey,
  type EmphasisVariant,
} from "@/features/kinetic-text";
import { resolveWordEmphasisVariant } from "../lib/emphasis-variant";
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
  /** Data-annotated phrase keys treated as bound phrases for shared emphasis styling. */
  phraseKeys?: readonly (readonly string[])[];
  /**
   * Caller-forced second highlight, rendered with its own variant instead of the
   * seeded pick. Lets one page carry two marks that read as different effects —
   * the vocabulary letter-count clue boxes its initial while the count keeps the
   * usual treatment. Single-token by design: multi-token runs are not grouped
   * into a shared frame wrapper.
   */
  secondaryEmphasized?: Set<number>;
  secondaryVariant?: EmphasisVariant;
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
  skipFrame?: boolean;
  /**
   * The enclosing run draws this word's moving effect (sweep, halo, glow, pulse,
   * jiggle) once across all of its syllables, so the word must not draw its own.
   */
  runEffect?: boolean;
  /**
   * The effect the whole run this word belongs in was dressed in. Handed down instead of
   * re-hashed per syllable, because a syllable's own seed only names the compound when the
   * pair is in the curated list; otherwise two syllables of one word pick two effects.
   */
  sharedVariant?: EmphasisVariant;
};

/**
 * Render one kinetic word with feed entrance + emphasis styling.
 * @param props - WordSequenceWordProps fields
 * @returns Rendered UI
 */
export function WordSequenceWord({
  word,
  index,
  words,
  spec,
  emphasized,
  phraseKeys,
  secondaryEmphasized,
  secondaryVariant,
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
  skipFrame = false,
  runEffect = false,
  sharedVariant,
}: WordSequenceWordProps): ReactElement {
  const hasGlyph = /\p{L}|\p{N}/u.test(word);
  // A masked answer ("_____", possibly with trailing punctuation) is split so the
  // run of underscores carries its own hook. The glyphs and their width are
  // untouched — a surface that wants the blank to read as a live slot rather than
  // five inert underscores styles `[data-kinetic-blank]`; everywhere else it
  // renders exactly as before.
  const blank = hasGlyph ? null : /^(_{2,})(.*)$/u.exec(word);
  // A token with no letter/number — trailing punctuation, or a masked "_____" answer
  // blank — can still be handed to us by the emphasis sets. Framing it would draw an
  // empty highlight box around nothing, so the resolver returns null for it whichever
  // selection path (heuristic, fallback, data annotation, secondary, poetic) proposed
  // it. A shared multi-syllable run shows a box-drawing `frame` as a continuous
  // underline; a lone `frame` word keeps its box.
  // Inside a run the group's effect is handed down rather than re-hashed from this
  // syllable: a syllable seeds from the curated phrase list, so a compound missing from
  // it would give each of its halves a different effect.
  const displayVariant =
    (hasGlyph ? sharedVariant : undefined) ??
    resolveWordEmphasisVariant({
      word,
      index,
      words,
      text: spec.text,
      emphasized,
      phraseKeys,
      secondaryEmphasized,
      secondaryVariant,
      emphasisColor,
      inRun: skipFrame,
    });
  const important = displayVariant !== null;
  const primary = important && emphasized.has(index);
  // A secondary mark is caller-forced and never drives the spotlight layout, so
  // adding one cannot re-centre the page or claim a full-width line.
  const spotlightWord = spotlightEmphasis && primary && !suppressSpotlight;
  const emphasisAnchorIndex = important
    ? getBoundPhraseStartIndex(words, index, phraseKeys)
    : index;
  // When the run this word sits in draws the effect once across all its syllables,
  // the word keeps its color and weight but adds no moving effect of its own.
  const ownEffect = runEffect ? null : displayVariant;
  const wordColor = important
    ? getCanvasEmphasisWordColor(displayVariant, textColor, emphasisColor)
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
        ...(displayVariant === "halo" || displayVariant === "glow"
          ? { "--kinetic-aura-color": getAuraColor(textColor) }
          : {}),
      } as CSSProperties)
    : undefined;
  const innerAnimation =
    important && !staticRender ? getEmphasisInnerAnimation(ownEffect) : undefined;
  const isSoloRevealWord = isSolo;
  const hidden = getEntranceHidden(entranceStyle, important, index);
  const safeHidden = isSolo
    ? { ...hidden, x: 0, rotate: 0, scale: Math.min(Number(hidden.scale ?? 1), 1) }
    : hidden;
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
        hidden: safeHidden,
        show: ENTRANCE_REST,
      }}
      transition={
        isSolo
          ? { delay: entranceDelay, duration: entranceDuration, ease: [0.22, 1, 0.36, 1] }
          : getEntranceTransition(entranceStyle, entranceDelay, entranceDuration)
      }
      className={important ? "relative inline-flex" : "inline-flex"}
      style={{
        color: wordColor,
        display: spotlightWord ? "inline-flex" : "inline-block",
        flexShrink: 0,
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
          ? getEmphasisTextShadow(displayVariant)
          : "0 4px 40px rgba(0,0,0,0.45)",
        animationPlayState: paused ? "paused" : "running",
        transformOrigin: leftAnchoredText && !spotlightWord ? "left center" : "center",
        // Small breathing room on top of the reserved fontSize width so the
        // bolder glyphs never kiss the adjacent words.
        marginTop: spotlightWord ? "0.08em" : undefined,
        marginBottom: spotlightWord ? "0.08em" : undefined,
        marginLeft: important && !spotlightWord && !skipFrame && !isSolo ? "0.04em" : undefined,
        marginRight: important && !spotlightWord && !skipFrame && !isSolo ? "0.04em" : undefined,
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
          data-kinetic-glyph=""
          className={
            important
              ? `kinetic-emphasis-mark${
                  ownEffect === "halo"
                    ? " kinetic-emph-halo"
                    : ownEffect === "frame"
                      ? // Only a lone word reaches here — a grouped `frame` was already
                        // downgraded to `underline` via displayVariant above.
                        " kinetic-emph-frame"
                      : ownEffect === "underline"
                        ? // A syllable inside a shared run joins its bar across the column
                          // gap, so a compound never shows an underline broken mid-word.
                          skipFrame
                          ? " kinetic-emph-underline is-joined"
                          : " kinetic-emph-underline"
                        : ownEffect === "sweep"
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
          {blank ? (
            <>
              <span data-kinetic-blank="">{blank[1]}</span>
              {blank[2]}
            </>
          ) : (
            word
          )}
        </span>
      </span>
    </motion.span>
  );
}
