/**
 * Compatibility shim — prefer `@/features/create-studio`.
 */
export type { AccentRecommendation } from "@/features/create-studio/lib/accent-suggestions";
export {
  createEmojiSticker,
  getAccentKeyword,
  getAccentRecommendation,
} from "@/features/create-studio/lib/accent-suggestions";
