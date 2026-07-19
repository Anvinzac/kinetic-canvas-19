/**
 * Sticky preview canvas + animation template rail for create-studio.
 *
 * Exports: StudioPreviewPane
 * Depends on: ComposerPreviewCanvas, StudioPreviewCanvas, StudioTemplateRail
 */

import type { CSSProperties, ReactElement } from "react";
import type {
  CanvasSpec,
  GradientTransitionPath,
  getCanvasPatternTheme,
  getCanvasSceneTheme,
} from "@/features/canvas";
import type { getComposerSlidingBackground } from "../lib/sliding-background";
import type { AnimationTemplate, BackgroundMode } from "../types";
import { ComposerPreviewCanvas } from "./ComposerPreviewCanvas";
import { StudioPreviewCanvas } from "./StudioPreviewCanvas";
import { StudioTemplateRail } from "./StudioTemplateRail";

export type StudioPreviewPaneProps = {
  previewRowHeight: string;
  previewPaneHeight: string;
  onFrameChange: (frame: { height: number }) => void;
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
  bg: string;
  selectedGradientPath: GradientTransitionPath;
  selectedSceneId: string;
  selectedPatternId: string;
  selectedPhoto: string;
  selectedVideo: string;
  onApplyTemplate: (template: AnimationTemplate) => void;
};

/**
 * Render the live preview canvas and template picker rail.
 * @param props - Preview visuals, page index, and template application
 * @returns Sticky preview section
 */
export function StudioPreviewPane(props: StudioPreviewPaneProps): ReactElement {
  return (
    <section className="sticky top-[calc(env(safe-area-inset-top,0px)+4.75rem)] z-20 -mx-4 bg-background/95 px-4 pb-4 backdrop-blur">
      <div
        className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-2"
        style={{ height: props.previewRowHeight, maxHeight: props.previewPaneHeight }}
      >
        <ComposerPreviewCanvas
          className="min-w-0 flex-1"
          style={{ height: "100%" } satisfies CSSProperties}
          maxHeight={props.previewPaneHeight}
          onFrameChange={props.onFrameChange}
        >
          <StudioPreviewCanvas
            onReplay={props.onReplay}
            previewScene={props.previewScene}
            previewPattern={props.previewPattern}
            previewSlidingBackground={props.previewSlidingBackground}
            previewBackground={props.previewBackground}
            playKey={props.playKey}
            backgroundMode={props.backgroundMode}
            activePhoto={props.activePhoto}
            activeVideo={props.activeVideo}
            currentTextPage={props.currentTextPage}
            previewSpec={props.previewSpec}
            previewAnimating={props.previewAnimating}
            selectedTransitionGradients={props.selectedTransitionGradients}
            safeBg={props.safeBg}
            spec={props.spec}
            composerPagesLength={props.composerPagesLength}
            activeTextPage={props.activeTextPage}
            articlePreview={props.articlePreview}
          />
        </ComposerPreviewCanvas>
        <StudioTemplateRail
          spec={props.spec}
          bg={props.bg}
          backgroundMode={props.backgroundMode}
          selectedGradientPath={props.selectedGradientPath}
          selectedSceneId={props.selectedSceneId}
          selectedPatternId={props.selectedPatternId}
          selectedPhoto={props.selectedPhoto}
          selectedVideo={props.selectedVideo}
          onApplyTemplate={props.onApplyTemplate}
        />
      </div>
    </section>
  );
}
