/**
 * Interactive preview button contents for create-studio canvas.
 *
 * Exports: StudioPreviewCanvas
 * Depends on: canvas, kinetic-text, framer-motion
 */

import { motion } from "framer-motion";
import { Link2, Type } from "lucide-react";
import type { ReactElement } from "react";
import { CanvasStickerLayer } from "@/components/CanvasStickerLayer";
import {
  getCanvasPatternTheme,
  getCanvasSceneTheme,
  getPatternBackgroundPosition,
  getSceneBackgroundStyle,
  type CanvasSpec,
} from "@/features/canvas";
import { KineticText } from "@/features/kinetic-text";
import type { getComposerSlidingBackground } from "../lib/sliding-background";
import type { BackgroundMode } from "../types";

export type StudioPreviewCanvasProps = {
  onReplay: () => void;
  previewScene: ReturnType<typeof getCanvasSceneTheme>;
  previewPattern: ReturnType<typeof getCanvasPatternTheme>;
  previewSlidingBackground: ReturnType<typeof getComposerSlidingBackground>;
  previewBackground: string;
  playKey: number;
  backgroundMode: BackgroundMode;
  activePhoto: string | null;
  activeVideo: string | null;
  currentTextPage: string;
  previewSpec: CanvasSpec;
  previewAnimating: boolean;
  selectedTransitionGradients: string[];
  safeBg: string;
  spec: CanvasSpec;
  composerPagesLength: number;
  activeTextPage: number;
  articlePreview: { url: string; host: string; title: string } | null;
};

/**
 * Render the tappable preview surface (backdrop, text, stickers, badges).
 * @param props - Preview visual state for the current text page
 * @returns Preview button element
 */
export function StudioPreviewCanvas(props: StudioPreviewCanvasProps): ReactElement {
  const {
    onReplay,
    previewScene,
    previewPattern,
    previewSlidingBackground,
    previewBackground,
    playKey,
    backgroundMode,
    activePhoto,
    activeVideo,
    currentTextPage,
    previewSpec,
    previewAnimating,
    selectedTransitionGradients,
    safeBg,
    spec,
    composerPagesLength,
    activeTextPage,
    articlePreview,
  } = props;

  return (
    <button
      type="button"
      onClick={onReplay}
      className="relative size-full overflow-hidden rounded-[24px] bg-black shadow-[0_24px_70px_rgba(0,0,0,0.45)] ring-1 ring-white/10"
      aria-label="Replay preview"
    >
      {previewScene ? (
        <span
          aria-hidden
          className="absolute inset-0"
          style={getSceneBackgroundStyle(previewScene, playKey)}
        />
      ): previewPattern ? (
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundColor: previewPattern.base,
            backgroundImage: previewPattern.image,
            backgroundSize: previewPattern.size,
            backgroundRepeat: "repeat",
            backgroundPosition: getPatternBackgroundPosition(previewPattern, playKey),
            transition: "background-position 0.95s cubic-bezier(0.22,1,0.36,1)",
          }}
        />
      ): previewSlidingBackground ? (
        <motion.span
          aria-hidden
          className="absolute inset-y-0 left-0"
          style={{
            background: previewSlidingBackground.background,
            width: previewSlidingBackground.width,
          }}
          initial={false}
          animate={{ x: previewSlidingBackground.x }}
          transition={{ duration: 0.95, ease: [0.22, 1, 0.36, 1] }}
        />
      ): (
        <span aria-hidden className="absolute inset-0" style={{ background: previewBackground }} />
      )}
      {(backgroundMode === "transition" || previewPattern || previewScene) && (
        <motion.span
          key={`${previewBackground}-sheen`}
          aria-hidden
          className="absolute inset-0 opacity-45 mix-blend-screen"
          style={{
            background:
              "linear-gradient(120deg,rgba(255,255,255,0.24),transparent 44%,rgba(255,255,255,0.16))",
          }}
          initial={{ x: "-18%", opacity: 0 }}
          animate={{ x: "0%", opacity: 0.45 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      )}
      {activePhoto && (
        <img src={activePhoto} alt="" className="absolute inset-0 size-full object-cover" />
      )}
      {activeVideo && (
        <video
          src={activeVideo}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 size-full object-cover"
        />
      )}
      {(activePhoto || activeVideo) && (
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/55" />
      )}
      {currentTextPage.trim() ? (
        <>
          <KineticText
            spec={previewSpec}
            playKey={playKey}
            scaleToCanvas
            staticLayout={!previewAnimating}
            background={
              backgroundMode === "transition"
                ? selectedTransitionGradients
                : previewScene
                  ? previewScene.base
                  : previewPattern
                    ? previewPattern.base
                    : safeBg
            }
          />
          <CanvasStickerLayer
            stickers={spec.stickers}
            text={currentTextPage}
            layout={previewSpec}
            playKey={playKey}
            compact
          />
        </>
      ): (
        <div className="absolute inset-0 grid place-items-center px-8 text-center">
          <div>
            <Type className="mx-auto size-7 text-white/65" />
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-white/60">
              type below
            </p>
          </div>
        </div>
      )}
      <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/35 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-white/65 backdrop-blur">
        {composerPagesLength > 1
          ? `page ${activeTextPage + 1}/${composerPagesLength}`
          : "tap to replay"}
      </span>
      {articlePreview && (
        <span className="absolute left-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-white text-black shadow-[0_10px_28px_rgba(0,0,0,0.4)]">
          <Link2 className="size-4" />
        </span>
      )}
    </button>
  );
}
