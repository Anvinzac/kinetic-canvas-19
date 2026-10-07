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
} from "@/features/canvas";
import {
  getDataEmphasisWordSpans,
  getEmphasisPhraseKeysForLayout,
  getEmphasizedRunPhraseKeys,
  getKineticTextLayoutMode,
  getLoopAnimation,
  getVietnameseLayoutMetrics,
  getWords,
  hasVisibleStickerAccent,
  isLikelyVietnameseText,
  type EmphasisVariant,
} from "@/features/kinetic-text";
import { getEmphasizedWordIndexes } from "../lib/feed-emphasis";
import { getEntranceStyle } from "../lib/entrances";
import {
  EMPHASIS_FONT_SCALE,
  EMPHASIS_SCALE_FIT_GUARD,
  TEXT_SAFE_MAX_WIDTH,
  VIETNAMESE_SCALE_FIT_GUARD,
} from "../lib/playback-timing";
import { estimateSoloRevealFit } from "../lib/solo-text-fit";
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
  fitAsUnit?: boolean;
  /**
   * Multiplier on the line-to-line advance. 1 keeps the renderer's own compact
   * display rhythm; a caller that needs reading air (the vocabulary card) passes
   * 1.2. Line pitch is made of two parts — `lineHeight` plus the explicit
   * per-line margin/gap — so both are scaled together and the requested factor is
   * the factor the reader actually gets. Never touches glyph width.
   */
  lineSpacingScale?: number;
  /** Optional upstream emphasis annotations; only phrases occurring in this page's text match. */
  dataEmphasis?: string[];
  /**
   * Optional second highlight drawn with its own effect. It bypasses both the
   * annotation budget and the per-language one-word cap, so a page can carry two
   * marks that read differently — the vocabulary letter-count clue boxes its
   * starting initial while the count keeps the primary mark.
   */
  secondaryEmphasis?: { phrase: string; variant: EmphasisVariant };
  /**
   * Whether an emphasised word may be drawn inside the box-shaped `frame`. The box adds
   * padding and a border around the word, which is height a landscape card does not
   * have; such a caller passes false and the frame is drawn as an underline. It also
   * applies to `secondaryEmphasis`. Defaults to true, so every other surface is unchanged.
   */
  allowFrameEmphasis?: boolean;
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
  fitAsUnit = false,
  lineSpacingScale = 1,
  dataEmphasis,
  secondaryEmphasis,
  allowFrameEmphasis = true,
}: WordSequenceTextProps): ReactElement {
  const words = useMemo(
    () => (fitAsUnit ? [spec.text.trim()] : getWords(spec.text)),
    [fitAsUnit, spec.text],
  );
  const isVietnamese = words.length > 1 && isLikelyVietnameseText(spec.text);
  const emphasized = useMemo(
    () => getEmphasizedWordIndexes(words, dataEmphasis),
    [words, dataEmphasis],
  );
  // Read the primitives, not the object, so a caller re-creating the literal each
  // render cannot churn the memo and rebuild the index set every frame.
  const secondaryPhrase = secondaryEmphasis?.phrase;
  const secondaryVariant = secondaryEmphasis?.variant;
  // Resolved against this page's own tokens, so a phrase pagination moved onto
  // another page simply matches nothing here.
  const secondaryEmphasized = useMemo(() => {
    if (!secondaryPhrase) return undefined;
    const indexes = new Set<number>();
    for (const span of getDataEmphasisWordSpans(words, [secondaryPhrase])) {
      for (let offset = 0; offset < span.length; offset += 1) indexes.add(span.start + offset);
    }
    return indexes.size > 0 ? indexes : undefined;
  }, [words, secondaryPhrase]);
  const hasEmphasis = emphasized.size > 0 || !!secondaryEmphasized?.size;
  // Annotated compounds act as bound phrases everywhere below: unbreakable line
  // segments plus one shared emphasis variant across all their syllables. The same
  // treatment is owed to every highlighted run, which the selection already decided
  // reads as one word — otherwise an unannotated compound can be packed apart and
  // each syllable hashes a different effect.
  const phraseKeys = useMemo(
    () => [
      ...getEmphasisPhraseKeysForLayout(dataEmphasis),
      ...getEmphasizedRunPhraseKeys(words, emphasized),
    ],
    [dataEmphasis, words, emphasized],
  );
  const isSolo = words.length <= 1;
  const visualScaleGuard = Math.max(
    hasEmphasis && !isSolo ? EMPHASIS_SCALE_FIT_GUARD : 1,
    isVietnamese ? VIETNAMESE_SCALE_FIT_GUARD : 1,
  );
  const vietnameseLayout = useMemo(
    () =>
      isVietnamese
        ? getVietnameseLayoutMetrics(words, canvasWidth, spec.size, visualScaleGuard, phraseKeys)
        : { lines: [], suggestedFitScale: 1 },
    [isVietnamese, words, canvasWidth, spec.size, visualScaleGuard, phraseKeys],
  );
  const entranceStyle = getEntranceStyle(entranceSeed ?? spec.text, spec.rhythm);
  const layoutMode = getKineticTextLayoutMode(spec.text, isVietnamese, words.length, emphasized);
  const leftAnchoredText = layoutMode !== "center";
  const spotlightEmphasis = layoutMode === "left-spotlight";
  const soloInitialFit = isSolo
    ? estimateSoloRevealFit(
        spec.text,
        spec.size,
        canvasWidth,
        visualScaleGuard,
        spec.font,
        hasEmphasis ? 900 : spec.weight,
        hasEmphasis ? EMPHASIS_FONT_SCALE : 1,
      )
    : 1;
  const initialFit = isSolo
    ? soloInitialFit
    : isVietnamese && !disableFit
      ? vietnameseLayout.suggestedFitScale
      : 1;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const staticRender = revealed || measure;
  const { fontSize, soloInlineScale, safeCenterY } = useWordSequenceFit({
    initialFit,
    measurementKey: `${playKey}-${staticRender}`,
    canvasWidth,
    background,
    spec,
    disableFit: disableFit && !isSolo,
    onFitScale,
    isSolo,
    isVietnamese,
    leftAnchoredText,
    visualScaleGuard,
    wrapperRef,
    textRef,
  });
  const textColor = photoBackdrop
    ? resolveTextColorOnPhotoBackdrop(spec)
    : getCanvasTextColor(spec, background);
  const emphasisColor = getCanvasEmphasisColor({ ...spec, color: textColor }, background);
  const photoTextShadow = photoBackdrop ? getPhotoBackdropTextShadow(textColor) : undefined;
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
          // A solo page is one unbreakable span, so it cannot wrap anyway; naming the
          // intent keeps the single-line answer from depending on that accident.
          flexWrap: isSolo ? "nowrap" : undefined,
          columnGap: isVietnamese ? undefined : "0.34em",
          rowGap: isVietnamese ? undefined : `${0.08 * lineSpacingScale}em`,
          fontFamily: spec.font,
          fontSize,
          color: textColor,
          fontWeight: spec.weight,
          letterSpacing: `${spec.letterSpacing}em`,
          lineHeight: (isVietnamese ? 1.04 : 0.9) * lineSpacingScale,
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
          lineSpacingScale={lineSpacingScale}
          vietnameseLines={vietnameseLayout.lines}
          words={words}
          emphasized={emphasized}
          phraseKeys={phraseKeys}
          secondaryEmphasized={secondaryEmphasized}
          secondaryVariant={secondaryVariant}
          allowFrame={allowFrameEmphasis}
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
