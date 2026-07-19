/**
 * Animation template list beside the create-studio preview canvas.
 *
 * Exports: StudioTemplateRail
 * Depends on: create-studio templates + TemplateButton
 */

import { Sparkles } from "lucide-react";
import type { ReactElement } from "react";
import type { CanvasSpec, GradientTransitionPath } from "@/features/canvas";
import { ANIMATION_TEMPLATES, isTemplateActive } from "../lib/templates";
import type { AnimationTemplate, BackgroundMode } from "../types";
import { TemplateButton } from "./TemplateButton";

export type StudioTemplateRailProps = {
  spec: CanvasSpec;
  bg: string;
  backgroundMode: BackgroundMode;
  selectedGradientPath: GradientTransitionPath;
  selectedSceneId: string;
  selectedPatternId: string;
  selectedPhoto: string;
  selectedVideo: string;
  onApplyTemplate: (template: AnimationTemplate) => void;
};

/**
 * Render the scrollable template rail next to the preview.
 * @param props - Current composer backdrop state and template click handler
 * @returns Template rail column
 */
export function StudioTemplateRail({
  spec,
  bg,
  backgroundMode,
  selectedGradientPath,
  selectedSceneId,
  selectedPatternId,
  selectedPhoto,
  selectedVideo,
  onApplyTemplate,
}: StudioTemplateRailProps): ReactElement {
  return (
    <div className="flex w-full max-h-40 shrink-0 flex-col sm:h-full sm:max-h-none sm:min-w-[132px] sm:w-[35%]">
      <div className="mb-1.5 flex items-center justify-between px-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-white/55">
        <span className="flex items-center gap-1">
          <Sparkles className="size-2.5" />
          templates
        </span>
        <span className="text-white/35">{ANIMATION_TEMPLATES.length}</span>
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-0.5 pt-0.5 scrollbar-hide">
        {ANIMATION_TEMPLATES.map((template) => (
          <TemplateButton
            key={template.id}
            template={template}
            active={isTemplateActive(
              template,
              spec,
              bg,
              backgroundMode,
              selectedGradientPath,
              selectedSceneId,
              selectedPatternId,
              selectedPhoto,
              selectedVideo,
            )}
            onClick={() => onApplyTemplate(template)}
          />
        ))}
      </div>
    </div>
  );
}
