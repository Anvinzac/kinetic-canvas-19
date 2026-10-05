/** Readable clue text and reveal detail, reusing existing kinetic primitives. Exports: VocabularyStage. Depends on: canvas, kinetic-text, stages, motion tokens. */
import { useLayoutEffect, useRef } from "react";
import { AnimatePresence, motion, type MotionValue, type Variants } from "framer-motion";
import type { CanvasSpec } from "@/features/canvas";
import { WordSequenceText } from "@/features/post-player";
import { EASE, SPRING } from "@/lib/motion";
import type { VocabularyWord } from "../lib/schema";
import type { LearningStage } from "../lib/stages";
import { VOCAB_LINE_SPACING_SCALE } from "../lib/presets";
import { FilledUsage, MarkedText } from "./MarkedText";
import { RevealBurst } from "./RevealBurst";

/** Horizontal travel of a clue page as it arrives and leaves, in px. */
const PAGE_ENTER_OFFSET = 34;
const PAGE_EXIT_OFFSET = 52;
/** Beat of stillness before the answer lands, so the reveal reads as an event. */
const REVEAL_HOLD_SECONDS = 0.14;
/** The meaning follows the word instead of competing with it. */
const DETAILS_DELAY_SECONDS = 0.34;

type PageMotion = { direction: number; reveal: boolean };

/**
 * A clue page slides in from the side the reader is heading towards and leaves
 * the other way, so paging has a direction instead of a cross-fade. The outgoing
 * page is quicker than the incoming one and the two overlap — the old sequential
 * fade spent almost half a second per page showing nothing at all.
 *
 * The answer is the exception: it does not slide, it lands — a short hold, then
 * an overshooting spring.
 */
const PAGE_VARIANTS: Variants = {
  enter: ({ direction, reveal }: PageMotion) =>
    reveal ? { opacity: 0, scale: 0.72 } : { opacity: 0, x: direction * PAGE_ENTER_OFFSET },
  center: ({ reveal }: PageMotion) => ({
    opacity: 1,
    x: 0,
    scale: 1,
    transition: reveal
      ? {
          scale: { ...SPRING.bouncy, delay: REVEAL_HOLD_SECONDS },
          opacity: { duration: 0.16, delay: REVEAL_HOLD_SECONDS },
        }
      : { x: SPRING.gentle, opacity: { duration: 0.22, ease: EASE.out } },
  }),
  exit: ({ direction }: PageMotion) => ({
    opacity: 0,
    x: direction * -PAGE_EXIT_OFFSET,
    transition: { duration: 0.18, ease: EASE.in },
  }),
};

const STILL_VARIANTS: Variants = {
  enter: { opacity: 1 },
  center: { opacity: 1 },
  exit: { opacity: 0, transition: { duration: 0 } },
};

/** Render only the current clue; answer details mount only on reveal. @param props Stage and presentation. @returns Accessible text. */
export function VocabularyStage({
  stage,
  word,
  spec,
  background,
  canvasWidth,
  active,
  playing,
  reducedMotion,
  playKey,
  direction,
  dragX,
}: {
  stage: LearningStage;
  word: VocabularyWord;
  spec: CanvasSpec;
  background: string;
  canvasWidth: number;
  active: boolean;
  playing: boolean;
  reducedMotion: boolean;
  playKey: number;
  /** 1 when the reader moved forward to this page, -1 when they stepped back. */
  direction: number;
  /** Live horizontal offset while a finger is dragging the page. */
  dragX: MotionValue<number>;
}) {
  const details = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (details.current) details.current.scrollTop = 0;
  }, [stage.id, playKey]);
  const pageMotion: PageMotion = { direction, reveal: !!stage.reveal };
  return (
    <motion.div
      className="vocab-stage"
      style={{ x: dragX }}
      aria-live={active ? "polite" : "off"}
      aria-atomic="true"
    >
      <p className="sr-only" lang={stage.lang}>
        {stage.text}
      </p>
      {stage.reveal && active && !reducedMotion && <RevealBurst key={playKey} />}
      <AnimatePresence custom={pageMotion} initial={false}>
        {active && (
          <motion.div
            key={`${stage.id}-${playKey}`}
            className="vocab-stage-text"
            lang={stage.lang}
            aria-hidden="true"
            custom={pageMotion}
            variants={reducedMotion ? STILL_VARIANTS : PAGE_VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {/* Deck emphasis annotations for the whole word are passed every stage;
                exact phrase matching keeps only the ones occurring in this stage's
                text, so unrelated annotations never glow. The letter-count clue also
                sends a second mark (its starting initial) drawn with its own effect.
                The text block itself stays still (loop: "none") — a page of clue
                text that bobs forever is harder to read; the life is in the backdrop
                and in the emphasised word. */}
            <WordSequenceText
              spec={{ ...spec, y: stage.reveal ? 34 : 46, loop: "none" }}
              playKey={playKey}
              paused={!playing}
              revealed={reducedMotion || !playing}
              canvasWidth={canvasWidth}
              background={background}
              entranceSeed={word.id}
              fitAsUnit={stage.reveal}
              lineSpacingScale={VOCAB_LINE_SPACING_SCALE}
              dataEmphasis={stage.dataEmphasis}
              secondaryEmphasis={stage.secondaryEmphasis}
            />
          </motion.div>
        )}
      </AnimatePresence>
      {stage.reveal && (
        <motion.div
          ref={details}
          className="vocab-reveal-details"
          tabIndex={0}
          aria-label="Word meaning and examples"
          initial={reducedMotion ? false : { opacity: 0, y: 30, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={
            reducedMotion ? { duration: 0 } : { ...SPRING.gentle, delay: DETAILS_DELAY_SECONDS }
          }
        >
          {(word.ipa || word.pos) && (
            <p className="vocab-pronunciation" lang="en">
              {word.ipa} {word.pos && <span>· {word.pos}</span>}
            </p>
          )}
          <p lang="vi">
            <MarkedText text={word.defVi} />
          </p>
          {word.usage.map((example, index) => (
            <div className="vocab-example" key={index}>
              <p lang="en">
                <FilledUsage text={example.en} word={word.word} />
              </p>
            </div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
