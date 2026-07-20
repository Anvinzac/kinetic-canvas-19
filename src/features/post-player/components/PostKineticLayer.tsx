/**
 * Kinetic text page, stickers, off-screen fit measurers, and page dots.
 *
 * Exports: PostKineticLayer
 * Depends on: framer-motion, CanvasStickerLayer, WordSequenceText, ExportWatermark
 */

import { AnimatePresence, motion } from "framer-motion";
import type { ReactElement } from "react";
import { CanvasStickerLayer } from "@/components/CanvasStickerLayer";
import type { CanvasSpec } from "@/features/canvas";
import { isSoloTextPage } from "../lib/playback-timing";
import type { Profile } from "../types";
import { ExportWatermark } from "./ExportWatermark";
import { WordSequenceText } from "./WordSequenceText";

export type PostKineticLayerProps = {
  author?: Profile;
  spec: CanvasSpec;
  displaySpec: CanvasSpec;
  textPages: string[];
  textPage: number;
  playKey: number;
  currentText: string;
  isVisible: boolean;
  isPaused: boolean;
  pageRevealed: boolean;
  canvasWidth: number;
  useSharedSize: boolean;
  needsSharedFit: boolean;
  uniformPageSize: number;
  staticCanvasBackground: string | null | undefined;
  hasPhotoBackdrop: boolean;
  isExporting: boolean;
  reportPageFit: (page: number, scale: number) => void;
  selectTextPage: (page: number) => void;
};

/**
 * Render kinetic text, stickers, fit probes, and page indicators.
 * @param props - PostKineticLayerProps fields
 * @returns Rendered UI
 */
export function PostKineticLayer({
  author,
  spec,
  displaySpec,
  textPages,
  textPage,
  playKey,
  currentText,
  isVisible,
  isPaused,
  pageRevealed,
  canvasWidth,
  useSharedSize,
  needsSharedFit,
  uniformPageSize,
  staticCanvasBackground,
  hasPhotoBackdrop,
  isExporting,
  reportPageFit,
  selectTextPage,
}: PostKineticLayerProps): ReactElement {
  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={`${textPage}-${playKey}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: isVisible ? 1 : 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45 }}
          className="absolute inset-0"
        >
          {isVisible && (
            <WordSequenceText
              spec={displaySpec}
              playKey={playKey}
              paused={isPaused}
              revealed={pageRevealed}
              canvasWidth={canvasWidth}
              disableFit={useSharedSize}
              background={staticCanvasBackground}
              photoBackdrop={hasPhotoBackdrop}
              entranceSeed={spec.text}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <CanvasStickerLayer
        stickers={spec.stickers}
        text={currentText}
        layout={displaySpec}
        playKey={`${textPage}-${playKey}`}
      />

      {isExporting && <ExportWatermark author={author} />}

      {needsSharedFit && isVisible && (
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {textPages.map((pageText, pageIndex) =>
            isSoloTextPage(pageText) ? null : (
              <WordSequenceText
                key={`measure-${pageIndex}-${pageText.length}`}
                spec={{ ...spec, text: pageText, size: uniformPageSize, entrance: "fade" }}
                playKey={0}
                paused
                revealed
                measure
                canvasWidth={canvasWidth}
                onFitScale={(scale) => reportPageFit(pageIndex, scale)}
                background={staticCanvasBackground}
                photoBackdrop={hasPhotoBackdrop}
              />
            ),
          )}
        </div>
      )}

      {!isExporting && textPages.length > 1 && (
        <div
          className="absolute bottom-24 left-1/2 z-20 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/25 px-2 py-1 backdrop-blur"
          onClick={(e) => e.stopPropagation()}
        >
          {textPages.map((_, page) => (
            <button
              key={page}
              type="button"
              onClick={() => selectTextPage(page)}
              className={`h-1.5 rounded-full transition ${
                page === textPage ? "w-6 bg-white" : "w-1.5 bg-white/35"
              }`}
              aria-label={`Replay text page ${page + 1}`}
            />
          ))}
        </div>
      )}
    </>
  );
}
