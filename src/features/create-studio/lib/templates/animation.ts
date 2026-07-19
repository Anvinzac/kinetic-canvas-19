/**
 * Animation template catalog and active-template matching for create-studio.
 *
 * Exports: ANIMATION_TEMPLATES, isTemplateActive
 * Depends on: templates/animation-a, animation-b
 */

import type { CanvasSpec, GradientTransitionPath } from "@/features/canvas";
import type { AnimationTemplate, BackgroundMode } from "../../types";
import { ANIMATION_TEMPLATES_A } from "./animation-a";
import { ANIMATION_TEMPLATES_B } from "./animation-b";

export const ANIMATION_TEMPLATES: AnimationTemplate[] = [
  ...ANIMATION_TEMPLATES_A,
  ...ANIMATION_TEMPLATES_B,
];

/**
 * Decide whether a template matches the current composer motion + backdrop.
 * @param template - template argument
 * @param spec - spec argument
 * @param bg - bg argument
 * @param backgroundMode - backgroundMode argument
 * @param selectedGradientPath - selectedGradientPath argument
 * @param selectedSceneId - selectedSceneId argument
 * @param selectedPatternId - selectedPatternId argument
 * @param selectedPhoto - selectedPhoto argument
 * @param selectedVideo - selectedVideo argument
 * @returns Boolean result
 */
export function isTemplateActive(
  template: AnimationTemplate,
  spec: CanvasSpec,
  bg: string,
  backgroundMode: BackgroundMode,
  selectedGradientPath: GradientTransitionPath,
  selectedSceneId: string,
  selectedPatternId: string,
  selectedPhoto: string,
  selectedVideo: string,
): boolean {
  const motionMatches =
    spec.font === template.spec.font &&
    spec.entrance === template.spec.entrance &&
    spec.loop === template.spec.loop &&
    spec.tempo === template.spec.tempo &&
    spec.rhythm === template.spec.rhythm;
  if (!motionMatches) return false;

  if (template.backdrop.mode === "gradient") {
    return backgroundMode === "gradient" && bg === template.backdrop.gradient;
  }
  if (template.backdrop.mode === "transition") {
    return backgroundMode === "transition" && selectedGradientPath.id === template.backdrop.path.id;
  }
  if (template.backdrop.mode === "scene") {
    return backgroundMode === "scene" && selectedSceneId === template.backdrop.sceneId;
  }
  if (template.backdrop.mode === "pattern") {
    return backgroundMode === "pattern" && selectedPatternId === template.backdrop.patternId;
  }
  if (template.backdrop.mode === "photo") {
    return backgroundMode === "photo" && selectedPhoto === template.backdrop.url;
  }
  return backgroundMode === "video" && selectedVideo === template.backdrop.url;
}
