/**
 * Feature-local TypeScript types and interfaces.
 *
 * Exports: BackgroundMode, StudioPage, TemplateBackdrop, AnimationTemplate
 * Depends on: @/features/canvas
 */

import type { CanvasSpec, GradientTransitionPath } from "@/features/canvas";

/**
 * @responsibility Discriminate create-studio backdrop source modes.
 */
export type BackgroundMode =
  | "gradient"
  | "transition"
  | "scene"
  | "pattern"
  | "photo"
  | "upload"
  | "video";

/**
 * @responsibility Name the studio editor sub-pages in the create flow.
 */
export type StudioPage = "write" | "background" | "font" | "color" | "layout" | "motion";

/**
 * @responsibility Describe a template's backdrop without mutating live composer state.
 */
export type TemplateBackdrop =
  | { mode: "gradient"; gradient: string }
  | { mode: "transition"; path: GradientTransitionPath }
  | { mode: "scene"; sceneId: string }
  | { mode: "pattern"; patternId: string }
  | { mode: "photo"; url: string }
  | { mode: "video"; url: string };

/**
 * @responsibility Bundle a named animation preset (mood, backdrop, partial canvas spec).
 */
export type AnimationTemplate = {
  id: string;
  label: string;
  mood: string;
  backdrop: TemplateBackdrop;
  spec: Partial<Omit<CanvasSpec, "text">>;
};
