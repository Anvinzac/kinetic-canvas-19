/**
 * Low-level CSS color parsing, HSL conversion, and contrast math for canvas text.
 *
 * Exports: RgbColor, HslColor, parse/extract helpers, luminance and contrast utilities
 * Depends on: none
 */

export type RgbColor = { r: number; g: number; b: number };
export type HslColor = { h: number; s: number; l: number };

const GREEN_BACKGROUND_MIN_HUE = 78;
const GREEN_BACKGROUND_MAX_HUE = 190;
const YELLOW_MIN_HUE = 35;
const YELLOW_MAX_HUE = 68;

export function extractCssColors(value: string) {
  return value.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g) ?? [value];
}

export function parseCssColor(value: string): RgbColor | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "white") return { r: 255, g: 255, b: 255 };
  if (normalized === "black") return { r: 0, g: 0, b: 0 };
  if (normalized.startsWith("#")) return parseHexColor(normalized);
  if (normalized.startsWith("rgb")) return parseRgbColor(normalized);
  if (normalized.startsWith("hsl")) return parseHslColor(normalized);
  return null;
}

export function parseHexColor(value: string): RgbColor | null {
  const hex = value.slice(1);
  if (![3, 4, 6, 8].includes(hex.length)) return null;
  const normalized =
    hex.length <= 4
      ? hex
          .slice(0, 3)
          .split("")
          .map((char) => char + char)
          .join("")
      : hex.slice(0, 6);
  const int = Number.parseInt(normalized, 16);
  if (Number.isNaN(int)) return null;
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

export function parseRgbColor(value: string): RgbColor | null {
  const parts = value.match(/[\d.]+%?/g);
  if (!parts || parts.length < 3) return null;
  const [r, g, b] = parts;
  return {
    r: parseRgbChannel(r),
    g: parseRgbChannel(g),
    b: parseRgbChannel(b),
  };
}

export function parseRgbChannel(value: string) {
  if (value.endsWith("%")) return clamp(Math.round((Number.parseFloat(value) / 100) * 255), 0, 255);
  return clamp(Math.round(Number.parseFloat(value)), 0, 255);
}

export function parseHslColor(value: string): RgbColor | null {
  const parts = value.match(/[-\d.]+%?/g);
  if (!parts || parts.length < 3) return null;
  const hue = Number.parseFloat(parts[0]);
  const saturation = Number.parseFloat(parts[1]) / 100;
  const lightness = Number.parseFloat(parts[2]) / 100;
  if ([hue, saturation, lightness].some(Number.isNaN)) return null;
  return hslToRgb({ h: hue, s: saturation, l: lightness });
}

export function hslToRgb({ h, s, l }: HslColor): RgbColor {
  const hue = (((h % 360) + 360) % 360) / 360;
  if (s === 0) {
    const value = Math.round(l * 255);
    return { r: value, g: value, b: value };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hueToRgb(p, q, hue + 1 / 3) * 255),
    g: Math.round(hueToRgb(p, q, hue) * 255),
    b: Math.round(hueToRgb(p, q, hue - 1 / 3) * 255),
  };
}

export function hueToRgb(p: number, q: number, t: number) {
  let hue = t;
  if (hue < 0) hue += 1;
  if (hue > 1) hue -= 1;
  if (hue < 1 / 6) return p + (q - p) * 6 * hue;
  if (hue < 1 / 2) return q;
  if (hue < 2 / 3) return p + (q - p) * (2 / 3 - hue) * 6;
  return p;
}

export function rgbToHsl({ r, g, b }: RgbColor): HslColor {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: lightness };

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue = 0;
  if (max === red) hue = (green - blue) / delta + (green < blue ? 6 : 0);
  else if (max === green) hue = (blue - red) / delta + 2;
  else hue = (red - green) / delta + 4;
  return { h: hue * 60, s: saturation, l: lightness };
}

export function isGreenishBackground(colors: RgbColor[]) {
  return colors.some((color) => {
    const hsl = rgbToHsl(color);
    return hsl.s > 0.28 && hsl.h >= GREEN_BACKGROUND_MIN_HUE && hsl.h <= GREEN_BACKGROUND_MAX_HUE;
  });
}

export function isYellowishColor(color: RgbColor) {
  const hsl = rgbToHsl(color);
  return hsl.s > 0.35 && hsl.h >= YELLOW_MIN_HUE && hsl.h <= YELLOW_MAX_HUE;
}

export function getAverageHueDistance(color: RgbColor, backgroundColors: RgbColor[]) {
  const hue = rgbToHsl(color).h;
  const distances = backgroundColors.map((background) =>
    getHueDistance(hue, rgbToHsl(background).h),
  );
  return distances.reduce((sum, value) => sum + value, 0) / Math.max(distances.length, 1);
}

export function getHueDistance(a: number, b: number) {
  const distance = Math.abs(a - b) % 360;
  return Math.min(distance, 360 - distance);
}

export function getColorDistance(a: RgbColor, b: RgbColor) {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

export function getMinimumContrast(color: RgbColor, backgrounds: RgbColor[]) {
  return Math.min(...backgrounds.map((background) => getContrastRatio(color, background)));
}

export function getMaximumLuminance(colors: RgbColor[]) {
  return Math.max(...colors.map(getRelativeLuminance));
}

export function getContrastRatio(a: RgbColor, b: RgbColor) {
  const lighter = Math.max(getRelativeLuminance(a), getRelativeLuminance(b));
  const darker = Math.min(getRelativeLuminance(a), getRelativeLuminance(b));
  return (lighter + 0.05) / (darker + 0.05);
}

export function getRelativeLuminance({ r, g, b }: RgbColor) {
  const [red, green, blue] = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
