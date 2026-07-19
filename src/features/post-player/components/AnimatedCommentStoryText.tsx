/**
 * Kinetic or fast-mode text renderer inside comment story canvases.
 *
 * Exports: AnimatedCommentStoryText
 * Depends on: framer-motion, lib/canvas, WordSequenceText
 */

import { motion } from "framer-motion";
import type { ReactElement } from "react";
import { DEFAULT_CANVAS, getCanvasTextColor, type CanvasSpec } from "@/lib/canvas";
import { WordSequenceText } from "./WordSequenceText";

export type AnimatedCommentStoryTextProps = {
  text: string;
  fullText: string;
  playKey: number;
  fastMode: boolean;
  background: string;
};

/**
 * Render comment story page text (kinetic or fast dump).
 * @param props - AnimatedCommentStoryTextProps fields
 * @returns Rendered UI
 */
export function AnimatedCommentStoryText({
  text,
  fullText,
  playKey,
  fastMode,
  background,
}: AnimatedCommentStoryTextProps): ReactElement {
  const displayText = fastMode ? fullText : text;
  const textColor = getCanvasTextColor({ color: "#ffffff" }, background);
  const commentSpec: CanvasSpec = {
    ...DEFAULT_CANVAS,
    text: displayText,
    font: "Space Grotesk",
    size: fastMode ? 42 : 72,
    color: textColor,
    weight: 900,
    letterSpacing: -0.035,
    x: 50,
    y: 52,
    entrance: "fade",
    loop: "float",
    tempo: "steady",
    rhythm: "stagger",
  };

  if (fastMode) {
    return (
      <div className="absolute inset-x-6 top-[18%] bottom-[16%] z-10 grid place-items-center">
        <motion.p
          key={playKey}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-h-full overflow-hidden text-center font-black leading-[1.02] text-white drop-shadow-[0_8px_34px_rgba(0,0,0,0.55)]"
          style={{ color: textColor, fontSize: "clamp(1.15rem, 3.5vh, 1.85rem)" }}
        >
          {displayText}
        </motion.p>
      </div>
    );
  }

  return (
    <WordSequenceText
      spec={commentSpec}
      playKey={playKey}
      paused={false}
      revealed={false}
      canvasWidth={390}
      background={background}
      entranceSeed={fullText}
    />
  );

}
