export type {
  BackgroundStyle,
  CanvasLinkPreview,
  CanvasSpec,
  CanvasSticker,
  Entrance,
  GradientTransitionPath,
  Loop,
  Rhythm,
  Tempo,
} from "./types";

export {
  COMMENT_CHIPS,
  DEFAULT_CANVAS,
  ENTRANCES,
  FONTS,
  GRADIENTS,
  LOOPS,
  PALETTE,
  RHYTHMS,
  SAFE_CANVAS_BACKGROUND,
  TEMPOS,
  TRANSITION_GRADIENT_PATHS,
} from "./catalog";

export { parseCanvas, serializeCanvas } from "./serialize";

export {
  getCanvasEmphasisColor,
  getCanvasEmphasisWordColor,
  getCanvasTextColor,
  getFallbackCanvasBackground,
  getPhotoBackdropTextShadow,
  isTooDarkCanvasBackground,
  isUsableCanvasBackground,
  resolveCanvasBackground,
  resolveTextColorOnPhotoBackdrop,
} from "./contrast";

export type { CanvasPatternTheme } from "./patterns";
export {
  CANVAS_PATTERN_THEMES,
  getCanvasPatternTheme,
  getPatternBackgroundPosition,
} from "./patterns";

export type { CanvasSceneTheme } from "./scenes";
export {
  CANVAS_SCENE_THEMES,
  getCanvasSceneTheme,
  getSceneBackgroundStyle,
} from "./scenes";
