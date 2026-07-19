/**
 * Canvas background usability and fallback gradient selection.
 *
 * Exports: resolveCanvasBackground, isUsableCanvasBackground, isTooDarkCanvasBackground, getFallbackCanvasBackground
 * Depends on: canvas catalog, contrast/color-math
 */

import { SAFE_CANVAS_BACKGROUND } from "../catalog";
import {
  extractCssColors,
  getRelativeLuminance,
  parseCssColor,
  type RgbColor,
} from "./color-math";

type CanvasBackgroundSeed = string | number | null | undefined;

/**
 * Resolve a usable CSS background-image, falling back when empty/invalid/too dark.
 * @param background - background argument
 * @param seed - seed argument
 * @returns Usable gradient/url background string
 */
export function resolveCanvasBackground(
  background: string | null | undefined,
  seed: CanvasBackgroundSeed = "kinetic",
): string {
  const value = background?.trim();
  if (isUsableCanvasBackground(value)) return value;
  return getFallbackCanvasBackground(seed);
}

/**
 * Pick a deterministic fallback gradient from a small catalog.
 * @param seed - seed argument
 * @returns One of the fallback linear-gradient strings
 */
export function getFallbackCanvasBackground(seed: CanvasBackgroundSeed = "kinetic"): string {
  const gradients = [
    "linear-gradient(135deg,#FF006E,#8338EC)",
    "linear-gradient(135deg,#3A86FF,#06FFA5)",
    "linear-gradient(135deg,#F72585,#118AB2)",
    "linear-gradient(135deg,#FFD60A,#FF006E)",
    SAFE_CANVAS_BACKGROUND,
  ];
  return gradients[getStableCanvasNumber(String(seed ?? "kinetic")) % gradients.length];
}

/**
 * Decide whether a background string is safe to paint as `background-image`.
 * @param background - background argument
 * @returns true when non-empty, renderable, and not too dark / not a rejected solid
 */
export function isUsableCanvasBackground(
  background: string | null | undefined,
): background is string {
  const value = background?.trim();
  if (!value) return false;

  const normalized = value.toLowerCase();
  if (
    normalized === "none" ||
    normalized === "transparent" ||
    normalized === "black" ||
    normalized === "#000" ||
    normalized === "#000000"
  ) {
    return false;
  }

  if (!isRenderableCanvasBackground(value)) return false;
  if (normalized.startsWith("url(")) return true;
  return !isTooDarkCanvasBackground(value);
}

/**
 * Detect backgrounds too dark for white/light kinetic captions.
 * @param background - background argument
 * @returns true when luminance heuristics say the backdrop is too dark
 */
export function isTooDarkCanvasBackground(background: string): boolean {
  const tokens = extractCssColors(background);
  const colors = tokens.map(parseCssColor).filter(Boolean) as RgbColor[];
  if (colors.length === 0) return tokens.length === 0;

  const luminance = colors.map(getRelativeLuminance);
  const average = luminance.reduce((sum, value) => sum + value, 0) / luminance.length;
  return (
    luminance.every((value) => value < 0.035) || (Math.min(...luminance) < 0.05 && average < 0.34)
  );
}

function isRenderableCanvasBackground(value: string) {
  if (typeof CSS !== "undefined" && typeof CSS.supports === "function") {
    return CSS.supports("background-image", value);
  }
  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith("url(")) return true;
  if (!/-?gradient\(/.test(normalized)) return false;
  const colors = extractCssColors(value);
  return colors.length > 0 && colors.every(isParseableColorToken);
}

function isParseableColorToken(token: string) {
  const value = token.trim().toLowerCase();
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    return [3, 4, 6, 8].includes(hex.length) && /^[0-9a-f]+$/.test(hex);
  }
  return /^(rgba?|hsla?|oklch|color)\(/.test(value);
}

function getStableCanvasNumber(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

