/**
 * Pure summary strings for create-studio composer chrome labels.
 *
 * Exports: getBackgroundSummary, getFontSummary, getLayoutSummary, getMotionSummary
 * Depends on: features/canvas scene/pattern themes, create-studio PLACEMENTS + types
 */

import {
  getCanvasPatternTheme,
  getCanvasSceneTheme,
  type CanvasSpec,
} from "@/features/canvas";
import { PLACEMENTS } from "./templates";
import type { BackgroundMode } from "../types";

/**
 * Label the active backdrop mode for the studio chrome summary row.
 * @param backgroundMode - Active composer background mode
 * @param selectedGradientPathLabel - Transition path label when mode is transition
 * @param selectedSceneId - Scene id when mode is scene
 * @param selectedPatternId - Pattern id when mode is pattern
 * @returns Short human-readable background summary
 */
export function getBackgroundSummary(
  backgroundMode: BackgroundMode,
  selectedGradientPathLabel: string,
  selectedSceneId: string,
  selectedPatternId: string,
): string {
  if (backgroundMode === "gradient") return "gradient";
  if (backgroundMode === "transition") return selectedGradientPathLabel;
  if (backgroundMode === "scene") return getCanvasSceneTheme(selectedSceneId)?.label ?? "scene";
  if (backgroundMode === "pattern") {
    return getCanvasPatternTheme(selectedPatternId)?.label ?? "pattern";
  }
  if (backgroundMode === "photo") return "preloaded photo";
  if (backgroundMode === "video") return "video";
  return "library photo";
}

/**
 * Format font family + size for the studio chrome summary row.
 * @param font - Canvas font family
 * @param size - Canvas font size in px
 * @returns Font summary string
 */
export function getFontSummary(font: string, size: number): string {
  return `${font} · ${size}px`;
}

/**
 * Resolve placement label from vertical position, or "custom".
 * @param y - Canvas vertical placement
 * @returns Layout summary string
 */
export function getLayoutSummary(y: number): string {
  return PLACEMENTS.find((placement) => placement.y === y)?.label ?? "custom";
}

/**
 * Format entrance · tempo · rhythm for the studio chrome summary row.
 * @param spec - Canvas spec providing motion fields
 * @returns Motion summary string
 */
export function getMotionSummary(
  spec: Pick<CanvasSpec, "entrance" | "tempo" | "rhythm">,
): string {
  return `${spec.entrance} · ${spec.tempo} · ${spec.rhythm}`;
}
