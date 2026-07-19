/**
 * Public barrel re-exports for this feature module.
 *
 * Exports: CreateStudioPage, AnimationTemplate, BackgroundMode, StudioPage, TemplateBackdrop, createEmojiSticker, getAccentKeyword, getAccentRecommendation, AccentRecommendation
 * Depends on: ./CreateStudioPage, ./types, ./lib/accent-suggestions
 */

export { CreateStudioPage } from "./CreateStudioPage";
export type {
  AnimationTemplate,
  BackgroundMode,
  StudioPage,
  TemplateBackdrop,
} from "./types";
export {
  createEmojiSticker,
  getAccentKeyword,
  getAccentRecommendation,
  type AccentRecommendation,
} from "./lib/accent-suggestions";
