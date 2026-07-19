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
 * @responsibility Resolve a usable CSS background-image, falling back when empty/invalid/too dark.
 * @inputs Raw background string + optional seed for stable fallback selection
 * @outputs Usable gradient/url background string
 * @pure true — may consult `CSS.supports` when available
 */
export function resolveCanvasBackground(
  background: string | null | undefined,
  seed: CanvasBackgroundSeed = "kinetic",
) {
  const value = background?.trim();
  if (isUsableCanvasBackground(value)) return value;
  return getFallbackCanvasBackground(seed);
}

/**
 * @responsibility Pick a deterministic fallback gradient from a small catalog.
 * @inputs Seed string/number (defaults to `"kinetic"`)
 * @outputs One of the fallback linear-gradient strings
 * @pure true
 */
export function getFallbackCanvasBackground(seed: CanvasBackgroundSeed = "kinetic") {
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
 * @responsibility Decide whether a background string is safe to paint as `background-image`.
 * @inputs Candidate background CSS value
 * @outputs true when non-empty, renderable, and not too dark / not a rejected solid
 * @pure true — may consult `CSS.supports` when available
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
 * @responsibility Detect backgrounds too dark for white/light kinetic captions.
 * @inputs CSS background value containing color tokens
 * @outputs true when luminance heuristics say the backdrop is too dark
 * @pure true
 */
export function isTooDarkCanvasBackground(background: string) {
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

