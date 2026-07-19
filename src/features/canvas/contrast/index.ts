/**
 * Canvas contrast barrel — readable text/emphasis colors on kinetic backdrops.
 *
 * Exports: getCanvasTextColor and related public helpers
 * Depends on: contrast/text-color, contrast/background
 */

export {
  getCanvasEmphasisColor,
  getCanvasEmphasisWordColor,
  getCanvasTextColor,
  getPhotoBackdropTextShadow,
  resolveTextColorOnPhotoBackdrop,
} from "./text-color";

export {
  getFallbackCanvasBackground,
  isTooDarkCanvasBackground,
  isUsableCanvasBackground,
  resolveCanvasBackground,
} from "./background";
