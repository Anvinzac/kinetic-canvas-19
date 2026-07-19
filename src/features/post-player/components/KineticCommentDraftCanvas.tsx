/**
 * Live kinetic preview of a draft comment in the comment tray.
 *
 * Exports: KineticCommentDraftCanvas
 * Depends on: framer-motion, AnimatedCommentStoryText
 */

import { motion } from "framer-motion";
import type { ReactElement } from "react";
import { AnimatedCommentStoryText } from "./AnimatedCommentStoryText";

export type KineticCommentDraftCanvasProps = {
  text: string;
  pageText: string;
  page: number;
  pageCount: number;
  playKey: number;
  background: string;
};

/**
 * @responsibility Preview the in-progress custom comment as a mini kinetic canvas.
 */
export function KineticCommentDraftCanvas({
  text,
  pageText,
  page,
  pageCount,
  playKey,
  background,
}: KineticCommentDraftCanvasProps): ReactElement {
  return (
    <motion.div
      className="relative mx-auto aspect-[9/16] h-full max-h-full max-w-full overflow-hidden rounded-[24px] text-white shadow-[0_20px_55px_rgba(0,0,0,0.38)] ring-1 ring-white/15"
      initial={{ scale: 0.96 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
    >
      <div aria-hidden className="absolute inset-0" style={{ background }} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_15%,rgba(255,255,255,0.22),transparent_30%),linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.52))]" />
      <AnimatedCommentStoryText
        text={pageText}
        fullText={text}
        playKey={playKey}
        fastMode={false}
        background={background}
      />
      {pageCount > 1 && (
        <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1">
          {Array.from({ length: pageCount }).map((_, index) => (
            <span
              key={index}
              className={`h-1 rounded-full transition ${
                index === page ? "w-5 bg-white" : "w-1 bg-white/35"
              }`}
            />
          ))}
        </div>
      )}
    </motion.div>
  );

}
