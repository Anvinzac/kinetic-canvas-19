/**
 * Compatibility shim — prefer `@/features/create-studio/lib/templates`.
 *
 * Exports: re-exports templates/index
 * Depends on: create-studio/lib/templates/*
 */

export {
  ANIMATION_TEMPLATES,
  DEFAULT_TRANSITION_PATH,
  PAGE_TITLES,
  PLACEMENTS,
  PRELOADED_PHOTOS,
  PRELOADED_VIDEOS,
  STATUS_CANVAS,
  isTemplateActive,
} from "./templates/index";
