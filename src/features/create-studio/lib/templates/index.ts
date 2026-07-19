/**
 * Create-studio templates barrel — status defaults, media, animation catalog.
 *
 * Exports: STATUS_CANVAS, PRELOADED_*, ANIMATION_TEMPLATES, isTemplateActive, ...
 * Depends on: templates/status, media, animation
 */

export { STATUS_CANVAS, PLACEMENTS, PAGE_TITLES, DEFAULT_TRANSITION_PATH } from "./status";
export { PRELOADED_PHOTOS, PRELOADED_VIDEOS } from "./media";
export { ANIMATION_TEMPLATES, isTemplateActive } from "./animation";
