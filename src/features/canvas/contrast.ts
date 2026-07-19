/**
 * Compatibility shim — prefer `@/features/canvas` contrast exports.
 *
 * Exports: re-exports contrast/index public API
 * Depends on: features/canvas/contrast
 */

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
} from "./contrast/index";
