/**
 * Scene, pattern, sliding gradient, or static canvas backdrop.
 *
 * Exports: PostCanvasBackdrop
 * Depends on: framer-motion, canvas-patterns, canvas-scenes, post-background
 */

import { motion } from "framer-motion";
import type { ReactElement } from "react";
import { getPatternBackgroundPosition, type CanvasPatternTheme } from "@/features/canvas";
import { getSceneBackgroundStyle, type CanvasSceneTheme } from "@/features/canvas";
import { DEFAULT_CANVAS_BACKGROUND } from "../lib/post-background";

export type PostCanvasBackdropProps = {
  postId: string;
  backgroundShiftPage: number;
  sceneTheme: CanvasSceneTheme | null | undefined;
  patternTheme: CanvasPatternTheme | null | undefined;
  slidingCanvasBackground: { background: string; width: string; x: string } | null;
  staticCanvasBackground: string | null | undefined;
  hasTransitionBackground: boolean;
};

/**
 * Paint the post canvas background layer (scene/pattern/gradient).
 * @param props - PostCanvasBackdropProps fields
 * @returns Rendered UI
 */
export function PostCanvasBackdrop({
  postId,
  backgroundShiftPage,
  sceneTheme,
  patternTheme,
  slidingCanvasBackground,
  staticCanvasBackground,
  hasTransitionBackground,
}: PostCanvasBackdropProps): ReactElement {
  return (
    <>
      {sceneTheme ? (
        <div
          aria-hidden
          className="absolute inset-0"
          style={getSceneBackgroundStyle(sceneTheme, backgroundShiftPage)}
        />
      ): patternTheme ? (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundColor: patternTheme.base,
            backgroundImage: patternTheme.image,
            backgroundSize: patternTheme.size,
            backgroundRepeat: "repeat",
            backgroundPosition: getPatternBackgroundPosition(patternTheme, backgroundShiftPage),
            transition: "background-position 1.25s cubic-bezier(0.22,1,0.36,1)",
          }}
        />
      ): slidingCanvasBackground ? (
        <motion.div
          aria-hidden
          className="absolute inset-y-0 left-0"
          style={{
            background: DEFAULT_CANVAS_BACKGROUND,
            backgroundImage: slidingCanvasBackground.background,
            width: slidingCanvasBackground.width,
          }}
          initial={false}
          animate={{ x: slidingCanvasBackground.x }}
          transition={{ duration: 1.25, ease: [0.22, 1, 0.36, 1] }}
        />
      ): (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: DEFAULT_CANVAS_BACKGROUND,
            backgroundImage: staticCanvasBackground ?? undefined,
          }}
        />
      )}
      {(hasTransitionBackground || patternTheme || sceneTheme) && (
        <motion.div
          key={`sheen-${postId}-${backgroundShiftPage}`}
          aria-hidden
          className="absolute inset-0 opacity-40 mix-blend-screen"
          style={{
            background:
              "linear-gradient(115deg,rgba(255,255,255,0.22),transparent 42%,rgba(255,255,255,0.14))",
          }}
          initial={{ x: "-18%", opacity: 0 }}
          animate={{ x: "0%", opacity: 0.34 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
        />
      )}
    </>
  );
}
