/**
 * Public helpers for readable canvas caption and emphasis colors.
 *
 * Exports: getCanvasTextColor, getCanvasEmphasisColor, photo-backdrop color helpers
 * Depends on: canvas types, contrast/color-math
 */

import type { CanvasSpec } from "../types";
import {
  getColorDistance,
  getMaximumLuminance,
  getMinimumContrast,
  getRelativeLuminance,
  isGreenishBackground,
  isYellowishColor,
  parseCssColor,
} from "./color-math";
import { getCanvasBackgroundColors, pickBestColor } from "./color-pick";

type CanvasBackgroundInput = string | null | undefined | readonly (string | null | undefined)[];

const EMPHASIS_ACCENT_COLORS = [
  "#FFBE0B",
  "#FF006E",
  "#8338EC",
  "#3A86FF",
  "#ffffff",
  "#111827",
] as const;
// When the surrounding text is white/light, an emphasized word must POP brighter,
// never duck into a dark color. Restricted to vivid, high-energy hues only —
// yellow, orange, lime, bright blue, hot pink, cyan — with no dark/neutral option.
const BRIGHT_EMPHASIS_ACCENT_COLORS = [
  "#FFBE0B",
  "#FB5607",
  "#9EF01A",
  "#3A86FF",
  "#FF006E",
  "#00E5FF",
] as const;
// Perceived luminance (0-255) at/above which text counts as light, so its
// emphasis should be drawn from the bright palette.
const LIGHT_TEXT_LUMINANCE = 180;
const MIN_EMPHASIS_TEXT_DISTANCE = 92;
const MIN_READABLE_TEXT_CONTRAST = 3.15;
const DARK_TEXT_LUMINANCE = 0.18;
const DARK_BACKGROUND_LUMINANCE = 0.24;
const SUBTLE_LIGHT_TEXT = "#FFF7ED";

/**
 * @responsibility Pick a readable text color when the canvas sits on a photo backdrop.
 * @inputs CanvasSpec color (requested text color)
 * @outputs Requested color when light enough; otherwise a subtle light fallback
 * @pure true
 */
export function resolveTextColorOnPhotoBackdrop(spec: Pick<CanvasSpec, "color">) {
  const requestedColor = spec.color.trim() || "#ffffff";
  const requestedRgb = parseCssColor(requestedColor);
  if (!requestedRgb) return SUBTLE_LIGHT_TEXT;
  if (getRelativeLuminance(requestedRgb) < DARK_TEXT_LUMINANCE) return SUBTLE_LIGHT_TEXT;
  return requestedColor;
}

/**
 * @responsibility Build a text-shadow string tuned for photo backdrops.
 * @inputs Resolved text color
 * @outputs CSS text-shadow value (stronger dark halo for light text)
 * @pure true
 */
export function getPhotoBackdropTextShadow(textColor: string) {
  const rgb = parseCssColor(textColor);
  const light = rgb ? getRelativeLuminance(rgb) > 0.55 : true;
  if (light) {
    return "0 2px 18px rgba(0,0,0,0.62), 0 1px 3px rgba(0,0,0,0.48), 0 4px 40px rgba(0,0,0,0.38)";
  }
  return "0 2px 16px rgba(0,0,0,0.55), 0 4px 40px rgba(0,0,0,0.45)";
}

/**
 * @responsibility Resolve a caption text color that stays readable on the canvas backdrop.
 * @inputs CanvasSpec color/background fields + optional CSS background input
 * @outputs Hex/CSS color string safe for the given backdrop
 * @pure true
 */
export function getCanvasTextColor(
  spec: Pick<CanvasSpec, "color" | "backgroundStyle" | "gradientPath">,
  background?: CanvasBackgroundInput,
) {
  const requestedColor = spec.color.trim() || "#ffffff";
  const requestedRgb = parseCssColor(requestedColor);
  const backgroundColors = getCanvasBackgroundColors(spec, background);
  if (!requestedRgb || backgroundColors.length === 0) return requestedColor;

  if (isGreenishBackground(backgroundColors) && isYellowishColor(requestedRgb)) {
    return "#ffffff";
  }

  const minimumContrast = getMinimumContrast(requestedRgb, backgroundColors);
  const tooDarkOnDark =
    getRelativeLuminance(requestedRgb) < DARK_TEXT_LUMINANCE &&
    getMaximumLuminance(backgroundColors) < DARK_BACKGROUND_LUMINANCE;
  if (!tooDarkOnDark && minimumContrast >= MIN_READABLE_TEXT_CONTRAST) return requestedColor;

  if (
    tooDarkOnDark &&
    getMinimumContrast(parseCssColor(SUBTLE_LIGHT_TEXT)!, backgroundColors) >= 3
  ) {
    return SUBTLE_LIGHT_TEXT;
  }

  return pickBestColor(
    [SUBTLE_LIGHT_TEXT, "#ffffff", "#111827", "#FF006E", "#3A86FF"],
    backgroundColors,
    {
      avoidYellowOnGreen: true,
      avoidColor: requestedColor,
    },
  );
}

/**
 * @responsibility Pick an emphasis accent that contrasts with both backdrop and body text.
 * @inputs CanvasSpec color/background fields + optional CSS background input
 * @outputs Accent color from the bright or general emphasis palette
 * @pure true
 */
export function getCanvasEmphasisColor(
  spec: Pick<CanvasSpec, "color" | "backgroundStyle" | "gradientPath">,
  background?: CanvasBackgroundInput,
) {
  const backgroundColors = getCanvasBackgroundColors(spec, background);
  const safeTextColor = getCanvasTextColor(spec, background);
  if (backgroundColors.length === 0) return getFallbackEmphasisColor(safeTextColor);

  // Light/white text gets a bright-only palette so emphasis pops up, never down
  // into a dark color that would vanish against the background.
  const palette = isLightColor(safeTextColor)
    ? BRIGHT_EMPHASIS_ACCENT_COLORS
    : EMPHASIS_ACCENT_COLORS;

  return pickBestColor(palette, backgroundColors, {
    avoidYellowOnGreen: true,
    avoidColor: safeTextColor,
  });
}

/**
 * @responsibility Choose the color used for an emphasized word given its visual variant.
 * @inputs Emphasis variant id, body text color, resolved emphasis accent
 * @outputs Color for the emphasized word (halo/glow keep body color)
 * @pure true
 */
export function getCanvasEmphasisWordColor(
  variant: string | null | undefined,
  textColor: string,
  emphasisColor: string,
) {
  if (variant === "halo" || variant === "glow") return textColor;
  return getDistinctEmphasisColor(textColor, emphasisColor);
}

function isLightColor(color: string) {
  const rgb = parseCssColor(color);
  if (!rgb) return false;
  const luminance = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
  return luminance >= LIGHT_TEXT_LUMINANCE;
}

function getFallbackEmphasisColor(color: string) {
  const normalized = color.trim().toLowerCase();
  if (normalized === "#000000" || normalized === "black") return "#8338EC";
  if (normalized === "#ffbe0b") return "#ffffff";
  return "#FFBE0B";
}

function getDistinctEmphasisColor(textColor: string, emphasisColor: string) {
  const textRgb = parseCssColor(textColor);
  const emphasisRgb = parseCssColor(emphasisColor);
  if (
    textRgb &&
    emphasisRgb &&
    getColorDistance(textRgb, emphasisRgb) >= MIN_EMPHASIS_TEXT_DISTANCE
  ) {
    return emphasisColor;
  }

  const fallbackPalette = isLightColor(textColor)
    ? ["#FF006E", "#3A86FF", "#FB5607", "#8338EC", "#00B4D8"]
    : ["#FFBE0B", "#FF006E", "#06FFA5", "#3A86FF", "#ffffff"];

  return (
    fallbackPalette.find((color) => {
      const fallbackRgb = parseCssColor(color);
      return (
        fallbackRgb &&
        (!textRgb || getColorDistance(fallbackRgb, textRgb) >= MIN_EMPHASIS_TEXT_DISTANCE)
      );
    }) ?? fallbackPalette[0]
  );
}

// Canvas backgrounds are always consumed as `background-image` (see PostCard),
// never `background-color` — a value that's valid background shorthand but not a
// valid <image> (e.g. a bare hex color) would silently fail to paint there and
// expose whatever sits underneath. Validate against `background-image` specifically.
