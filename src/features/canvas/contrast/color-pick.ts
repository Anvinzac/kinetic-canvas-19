/**
 * Rank candidate text/emphasis colors against canvas backdrop samples.
 *
 * Exports: pickBestColor, getCanvasBackgroundColors
 * Depends on: contrast/color-math
 */

import type { CanvasSpec } from "../types";
import {
  type RgbColor,
  extractCssColors,
  getAverageHueDistance,
  getColorDistance,
  getMinimumContrast,
  isGreenishBackground,
  isYellowishColor,
  parseCssColor,
  rgbToHsl,
} from "./color-math";

type CanvasBackgroundInput = string | null | undefined | readonly (string | null | undefined)[];

/**
 * Compute canvasbackgroundcolors.
 * @param spec - spec argument
 * @param background? - background? argument
 * @returns Computed value
 */
export function getCanvasBackgroundColors(
  spec: Pick<CanvasSpec, "backgroundStyle" | "gradientPath">,
  background?: CanvasBackgroundInput,
): RgbColor[] {
  const sources = [
    ...normalizeBackgroundInput(background),
    ...(spec.backgroundStyle === "transition" ? (spec.gradientPath ?? []): []),
  ];
  const colors = sources.flatMap(extractCssColors).map(parseCssColor).filter(Boolean);
  return colors.length > 0 ? (colors as RgbColor[]): [];
}

function normalizeBackgroundInput(background: CanvasBackgroundInput) {
  if (!background) return [];
  return Array.isArray(background) ? background.filter(Boolean): [background];
}

/**
 * pickBestColor helper
 * @param candidates - candidates argument
 * @param backgroundColors - backgroundColors argument
 * @param options - options argument
 * @returns Computed value
 */
export function pickBestColor(
  candidates: readonly string[],
  backgroundColors: RgbColor[],
  options: { avoidYellowOnGreen?: boolean; avoidColor?: string } = {},
): string {
  const greenishBackground = isGreenishBackground(backgroundColors);
  const avoidRgb = options.avoidColor ? parseCssColor(options.avoidColor): null;

  const ranked = candidates
    .map((color) => {
      const rgb = parseCssColor(color);
      if (!rgb) return null;
      const hsl = rgbToHsl(rgb);
      const minimumContrast = getMinimumContrast(rgb, backgroundColors);
      const averageHueDistance = getAverageHueDistance(rgb, backgroundColors);
      const isYellowOnGreen =
        options.avoidYellowOnGreen && greenishBackground && isYellowishColor(rgb);
      const isMintOnGreen = greenishBackground && hsl.h >= 130 && hsl.h <= 175 && hsl.s > 0.35;
      const tooCloseToText = avoidRgb ? getColorDistance(rgb, avoidRgb) < 46 : false;

      let score = minimumContrast * 4 + averageHueDistance / 28;
      if (isYellowOnGreen) score -= 1000;
      if (isMintOnGreen) score -= 120;
      if (tooCloseToText) score -= 90;
      if (color.toLowerCase() === "#ffffff") score += 0.35;
      if (color.toLowerCase() === "#ff006e" && greenishBackground) score += 1.2;
      if (color.toLowerCase() === "#8338ec" && greenishBackground) score += 0.8;

      return { color, score };
    })
    .filter(Boolean)
    .sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0));

  return ranked[0]?.color ?? candidates[0] ?? "#ffffff";
}
