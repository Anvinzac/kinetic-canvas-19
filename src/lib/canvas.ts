/**
 * Compatibility shim — prefer `@/features/canvas`.
 */
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
} from "@/features/canvas";

export {
  COMMENT_CHIPS,
  DEFAULT_CANVAS,
  ENTRANCES,
  FONTS,
  getCanvasEmphasisColor,
  getCanvasEmphasisWordColor,
  getCanvasTextColor,
  getFallbackCanvasBackground,
  getPhotoBackdropTextShadow,
  GRADIENTS,
  isTooDarkCanvasBackground,
  isUsableCanvasBackground,
  LOOPS,
  PALETTE,
  parseCanvas,
  resolveCanvasBackground,
  resolveTextColorOnPhotoBackdrop,
  RHYTHMS,
  SAFE_CANVAS_BACKGROUND,
  serializeCanvas,
  TEMPOS,
  TRANSITION_GRADIENT_PATHS,
} from "@/features/canvas";
