/**
 * Pure helpers for emphasis.
 *
 * Exports: EMPHASIS_VARIANTS, NON_LUMINOUS_EMPHASIS_VARIANTS, EmphasisVariant, getEmphasisVariant, isDimEmphasisColor, getEmphasisTextShadow, getEmphasisInnerAnimation, getAuraColor, isWhiteLikeColor
 * Depends on: ./stable-hash
 */

import { getStableNumber } from "./stable-hash";

export const EMPHASIS_VARIANTS = [
  "color",
  "sweep",
  "glow",
  "underline",
  "jiggle",
  "pulse",
  "halo",
  "frame",
] as const;

// glow and halo are luminous auras — they only read well on bright colors. On a
// dim/dark emphasis color they turn into an ugly muddy blob, so those colors get
// the non-luminous set only. sweep is a recolor + gliding shine, so it reads on
// any color.
export const NON_LUMINOUS_EMPHASIS_VARIANTS = [
  "color",
  "sweep",
  "underline",
  "jiggle",
  "pulse",
  "frame",
] as const;

export type EmphasisVariant = (typeof EMPHASIS_VARIANTS)[number];

/**
 * Pick a stable emphasis visual variant for a word/phrase anchor.
 * @param text - text argument
 * @param emphasisSeed - emphasisSeed argument
 * @param anchorIndex - anchorIndex argument
 * @param allowLuminous - allowLuminous argument
 * @returns One of EMPHASIS_VARIANTS (or the non-luminous subset)
 */
export function getEmphasisVariant(
  text: string,
  emphasisSeed: string,
  anchorIndex: number,
  allowLuminous: boolean,
): EmphasisVariant {
  const pool: readonly EmphasisVariant[] = allowLuminous
    ? EMPHASIS_VARIANTS
    : NON_LUMINOUS_EMPHASIS_VARIANTS;
  return pool[getStableNumber(`${text}|${emphasisSeed}|${anchorIndex}`) % pool.length];
}

/**
 * Detect dim/dark hex colors where glow/halo would look muddy.
 * @param color - color argument
 * @returns true when max RGB channel / 255 < 0.42
 */
export function isDimEmphasisColor(color: string): boolean {
  const hex = color.trim().replace(/^#/, "");
  const full = hex.length === 3 ? hex.replace(/(.)/g, "$1$1"): hex;
  if (full.length !== 6) return false;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return Math.max(r, g, b) / 255 < 0.42;
}

/**
 * Resolve text-shadow for an emphasis variant.
 * @param variant - variant argument
 * @returns CSS text-shadow string
 */
export function getEmphasisTextShadow(variant: EmphasisVariant | null): string {
  if (variant === "color") {
    return "0 4px 40px rgba(0,0,0,0.45)";
  }
  if (variant === "sweep") {
    return "0 0 22px rgba(255,255,255,0.3), 0 5px 36px rgba(0,0,0,0.55)";
  }
  if (variant === "halo") {
    return "0 4px 40px rgba(0,0,0,0.45)";
  }
  if (variant === "glow") {
    return "0 0 0.14em var(--kinetic-aura-color, #FFBE0B), 0 0 0.4em var(--kinetic-aura-color, #FFBE0B), 0 5px 30px rgba(0,0,0,0.5)";
  }
  if (variant === "frame") {
    return "0 2px 16px rgba(0,0,0,0.5)";
  }
  return "0 0 22px rgba(255,255,255,0.35), 0 5px 36px rgba(0,0,0,0.55)";
}

/**
 * CSS animation for transform/filter emphasis variants (not halo/frame).
 * @param variant - variant argument
 * @returns CSS animation shorthand, or undefined
 */
export function getEmphasisInnerAnimation(variant: EmphasisVariant | null): string | undefined {
  if (variant === "jiggle") return "kinetic-emphasis-jiggle 0.58s ease-in-out 0.08s 2";
  if (variant === "pulse") return "kinetic-emphasis-pulse 1.35s ease-in-out infinite";
  if (variant === "glow") return "kinetic-emphasis-glow 1.6s ease-in-out infinite";
  return undefined;
}

/**
 * Aura color for halo/glow — gold on white-like text, else currentColor.
 * @param textColor - textColor argument
 * @returns CSS color used by --kinetic-aura-color
 */
export function getAuraColor(textColor: string): string {
  return isWhiteLikeColor(textColor) ? "#FFBE0B" : "currentColor";
}

/**
 * Detect white / near-white named or hex text colors.
 * @param color - color argument
 * @returns true for white, #fff, #ffffff
 */
export function isWhiteLikeColor(color: string): boolean {
  const normalized = color.trim().toLowerCase();
  return normalized === "white" || normalized === "#fff" || normalized === "#ffffff";
}
