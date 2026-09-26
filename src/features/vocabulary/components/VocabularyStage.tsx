/** Readable clue text and reveal detail, reusing existing kinetic primitives. Exports: VocabularyStage. Depends on: canvas, kinetic-text, stages. */
import { useLayoutEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { CanvasSpec } from "@/features/canvas";
import { WordSequenceText } from "@/features/post-player";
import type { VocabularyWord } from "../lib/schema";
import { completeUsage, type LearningStage } from "../lib/stages";

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
}) {
  const details = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (details.current) details.current.scrollTop = 0;
  }, [stage.id, playKey]);
  return (
    <div className="vocab-stage" aria-live={active ? "polite" : "off"} aria-atomic="true">
      <p className="vocab-eyebrow">{stage.label}</p>
      <p className="sr-only" lang={stage.lang}>
        {stage.text}
      </p>
      <AnimatePresence mode="wait">
        {active && (
          <motion.div
            key={`${stage.id}-${playKey}`}
            className="vocab-stage-text"
            lang={stage.lang}
            aria-hidden="true"
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.45 }}
          >
            <WordSequenceText
              spec={{
                ...spec,
                y: stage.reveal ? 34 : 46,
                loop: reducedMotion ? "none" : spec.loop,
              }}
              playKey={playKey}
              paused={!playing}
              revealed={reducedMotion || !playing}
              canvasWidth={canvasWidth}
              background={background}
              entranceSeed={word.id}
              fitAsUnit={stage.reveal}
            />
          </motion.div>
        )}
      </AnimatePresence>
      {stage.reveal && (
        <div
          ref={details}
          className="vocab-reveal-details"
          tabIndex={0}
          aria-label="Word meaning and examples"
        >
          {(word.ipa || word.pos) && (
            <p className="vocab-pronunciation" lang="en">
              {word.ipa} {word.pos && <span>· {word.pos}</span>}
            </p>
          )}
          <p lang="vi">{word.defVi}</p>
          {word.usage.map((example, index) => (
            <div className="vocab-example" key={index}>
              <p lang="en">{completeUsage(example.en, word.word)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
