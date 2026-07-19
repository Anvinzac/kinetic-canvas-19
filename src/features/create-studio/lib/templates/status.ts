/**
 * Default status canvas, placements, page titles, and transition path for create-studio.
 *
 * Exports: STATUS_CANVAS, PLACEMENTS, PAGE_TITLES, DEFAULT_TRANSITION_PATH
 * Depends on: features/canvas defaults
 */

import {
  DEFAULT_CANVAS,
  GRADIENTS,
  SAFE_CANVAS_BACKGROUND,
  TRANSITION_GRADIENT_PATHS,
  type CanvasSpec,
  type GradientTransitionPath,
} from "@/features/canvas";
import type { StudioPage } from "../../types";

export const STATUS_CANVAS: CanvasSpec = {
  ...DEFAULT_CANVAS,
  text: "",
  size: 96,
  x: 50,
  y: 50,
  entrance: "scale",
  loop: "pulse",
};

export const PLACEMENTS = [
  { label: "top", x: 50, y: 32 },
  { label: "center", x: 50, y: 50 },
  { label: "low", x: 50, y: 68 },
];

export const PAGE_TITLES: Record<StudioPage, { title: string; subtitle: string }> = {
  write: { title: "STATUS STUDIO", subtitle: "type · preview · post" },
  background: { title: "BACKGROUND", subtitle: "gradient · flow · photo" },
  font: { title: "FONT", subtitle: "family · scale · weight" },
  color: { title: "COLOR", subtitle: "text tone" },
  layout: { title: "LAYOUT", subtitle: "placement" },
  motion: { title: "MOTION", subtitle: "style · speed · rhythm" },
};

export const DEFAULT_TRANSITION_PATH: GradientTransitionPath = TRANSITION_GRADIENT_PATHS[0] ?? {
  id: "aurora-rush",
  label: "aurora rush",
  mood: "hot pink -> electric blue -> acid green",
  gradients: [GRADIENTS[0], GRADIENTS[1], SAFE_CANVAS_BACKGROUND],
};
