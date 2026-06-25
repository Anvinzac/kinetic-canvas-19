// CanvasSpec — kinetic typography specification stored as JSON in posts.canvas_html
// Kept compact (<1KB typical, <1MB hard cap)

export type Entrance = "fade" | "slide" | "scale" | "blur" | "split";
export type Loop = "pulse" | "float" | "shake" | "none";
export type Tempo = "slow" | "steady" | "snappy";
export type Rhythm = "smooth" | "stagger" | "burst" | "poetic";
export type BackgroundStyle = "static" | "transition";

export interface CanvasLinkPreview {
  url: string;
  host: string;
  title: string;
}

export interface CanvasSticker {
  id: string;
  kind: "emoji" | "gif";
  word: string;
  emoji?: string;
  url?: string;
  title?: string;
  x: number;
  y: number;
  size: number;
}

export interface CanvasSpec {
  text: string;
  font: string; // "Inter" | "Space Grotesk" | "Bebas Neue" | "Playfair Display" | "JetBrains Mono"
  size: number; // px
  color: string; // hex/oklch
  weight: number; // 100-900
  letterSpacing: number; // em
  x: number; // 0-100 (% of container)
  y: number; // 0-100
  entrance: Entrance;
  loop: Loop;
  tempo: Tempo;
  rhythm: Rhythm;
  rotation: number; // degrees
  link?: CanvasLinkPreview | null;
  stickers?: CanvasSticker[];
  backgroundStyle?: BackgroundStyle;
  gradientPath?: string[];
  // Id of a seamless tiling pattern backdrop (see canvas-patterns.ts). When set,
  // it replaces the gradient backdrop and pans a fixed step per page turn.
  backgroundPattern?: string;
  // Id of a generated layered scene backdrop (see canvas-scenes.ts). Scenes are
  // composed from CSS sheets/textures rather than gradients, photos, or videos.
  backgroundScene?: string;
}

type RgbColor = { r: number; g: number; b: number };
type HslColor = { h: number; s: number; l: number };
type CanvasBackgroundInput = string | null | undefined | readonly (string | null | undefined)[];
type CanvasBackgroundSeed = string | number | null | undefined;

export const SAFE_CANVAS_BACKGROUND = "linear-gradient(135deg,#00B4D8,#FF006E)";

export const DEFAULT_CANVAS: CanvasSpec = {
  text: "TYPE.",
  font: "Space Grotesk",
  size: 96,
  color: "#ffffff",
  weight: 900,
  letterSpacing: -0.04,
  x: 50,
  y: 50,
  entrance: "scale",
  loop: "pulse",
  tempo: "steady",
  rhythm: "stagger",
  rotation: 0,
  link: null,
  stickers: [],
  backgroundStyle: "static",
  gradientPath: [],
};

export const FONTS = [
  "Inter",
  "Space Grotesk",
  "Bebas Neue",
  "Playfair Display",
  "JetBrains Mono",
] as const;
export const ENTRANCES: Entrance[] = ["fade", "slide", "scale", "blur", "split"];
export const LOOPS: Loop[] = ["pulse", "float", "shake", "none"];
export const TEMPOS: Tempo[] = ["slow", "steady", "snappy"];
export const RHYTHMS: Rhythm[] = ["smooth", "stagger", "burst", "poetic"];

export const PALETTE = [
  "#ffffff",
  "#FF006E",
  "#06FFA5",
  "#FFBE0B",
  "#3A86FF",
  "#8338EC",
  "#000000",
];

export const GRADIENTS = [
  "linear-gradient(135deg,#FF006E,#8338EC)",
  "linear-gradient(135deg,#06FFA5,#00B4D8)",
  "linear-gradient(135deg,#FB5607,#FFBE0B)",
  "linear-gradient(135deg,#3A86FF,#8338EC)",
  "linear-gradient(135deg,#F72585,#7209B7)",
  "linear-gradient(135deg,#FFD60A,#FF006E)",
  "linear-gradient(135deg,#06D6A0,#118AB2)",
  "linear-gradient(135deg,#00B4D8,#FF006E)",
  "linear-gradient(135deg,#9D4EDD,#FF006E)",
  "linear-gradient(135deg,#F8C8DC,#7C3AED)",
  SAFE_CANVAS_BACKGROUND,
];

export type GradientTransitionPath = {
  id: string;
  label: string;
  mood: string;
  gradients: readonly string[];
};

export const TRANSITION_GRADIENT_PATHS: readonly GradientTransitionPath[] = [
  {
    id: "aurora-rush",
    label: "aurora rush",
    mood: "hot pink -> electric blue -> acid green",
    gradients: [
      "linear-gradient(135deg,#FF006E,#8338EC)",
      "linear-gradient(135deg,#8338EC,#3A86FF)",
      "linear-gradient(135deg,#3A86FF,#06FFA5)",
      "linear-gradient(135deg,#06FFA5,#FFBE0B)",
      "linear-gradient(135deg,#FFBE0B,#FF006E)",
    ],
  },
  {
    id: "solar-wave",
    label: "solar wave",
    mood: "sunset -> lagoon -> violet flash",
    gradients: [
      "linear-gradient(135deg,#FB5607,#FFBE0B)",
      "linear-gradient(135deg,#FFBE0B,#06FFA5)",
      "linear-gradient(135deg,#06FFA5,#00B4D8)",
      "linear-gradient(135deg,#00B4D8,#9D4EDD)",
      "linear-gradient(135deg,#9D4EDD,#FF006E)",
    ],
  },
  {
    id: "prism-drift",
    label: "prism drift",
    mood: "rose -> mint -> cobalt -> gold",
    gradients: [
      "linear-gradient(135deg,#F72585,#7209B7)",
      "linear-gradient(135deg,#7209B7,#06D6A0)",
      "linear-gradient(135deg,#06D6A0,#F9F871)",
      "linear-gradient(135deg,#F9F871,#3A86FF)",
      "linear-gradient(135deg,#3A86FF,#FFBE0B)",
    ],
  },
  {
    id: "rose-lullaby",
    label: "rose lullaby",
    mood: "blush -> lavender -> moonlit blue",
    gradients: [
      "linear-gradient(135deg,#F8C8DC,#7C3AED)",
      "linear-gradient(135deg,#7C3AED,#3A86FF)",
      "linear-gradient(135deg,#3A86FF,#B8F7D4)",
      "linear-gradient(135deg,#B8F7D4,#F8C8DC)",
    ],
  },
] as const;

export const COMMENT_CHIPS: { id: string; emoji: string; label: string }[] = [
  { id: "fire", emoji: "🔥", label: "fire" },
  { id: "heart", emoji: "❤️", label: "love" },
  { id: "wow", emoji: "😮", label: "wow" },
  { id: "laugh", emoji: "😂", label: "lol" },
  { id: "clap", emoji: "👏", label: "clap" },
  { id: "mind-blown", emoji: "🤯", label: "mind blown" },
  { id: "obsessed", emoji: "✨", label: "obsessed" },
  { id: "vibe", emoji: "🌀", label: "vibe" },
  { id: "genius", emoji: "🧠", label: "genius" },
  { id: "goals", emoji: "🎯", label: "goals" },
];

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
const GREEN_BACKGROUND_MIN_HUE = 78;
const GREEN_BACKGROUND_MAX_HUE = 190;
const YELLOW_MIN_HUE = 35;
const YELLOW_MAX_HUE = 68;
const MIN_READABLE_TEXT_CONTRAST = 3.15;
const DARK_TEXT_LUMINANCE = 0.18;
const DARK_BACKGROUND_LUMINANCE = 0.24;
const SUBTLE_LIGHT_TEXT = "#FFF7ED";

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

export function parseCanvas(raw: string | null | undefined): CanvasSpec {
  if (!raw) return DEFAULT_CANVAS;
  try {
    const obj = JSON.parse(raw);
    return { ...DEFAULT_CANVAS, ...obj, stickers: Array.isArray(obj.stickers) ? obj.stickers : [] };
  } catch {
    return { ...DEFAULT_CANVAS, text: raw };
  }
}

export function serializeCanvas(spec: CanvasSpec): string {
  return JSON.stringify(spec);
}

export function resolveCanvasBackground(
  background: string | null | undefined,
  seed: CanvasBackgroundSeed = "kinetic",
) {
  const value = background?.trim();
  if (isUsableCanvasBackground(value)) return value;
  return getFallbackCanvasBackground(seed);
}

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

function getCanvasBackgroundColors(
  spec: Pick<CanvasSpec, "backgroundStyle" | "gradientPath">,
  background?: CanvasBackgroundInput,
) {
  const sources = [
    ...normalizeBackgroundInput(background),
    ...(spec.backgroundStyle === "transition" ? (spec.gradientPath ?? []) : []),
  ];
  const colors = sources.flatMap(extractCssColors).map(parseCssColor).filter(Boolean);
  return colors.length > 0 ? (colors as RgbColor[]) : [];
}

function normalizeBackgroundInput(background: CanvasBackgroundInput) {
  if (!background) return [];
  return Array.isArray(background) ? background.filter(Boolean) : [background];
}

function extractCssColors(value: string) {
  return value.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g) ?? [value];
}

function pickBestColor(
  candidates: readonly string[],
  backgroundColors: RgbColor[],
  options: { avoidYellowOnGreen?: boolean; avoidColor?: string } = {},
) {
  const greenishBackground = isGreenishBackground(backgroundColors);
  const avoidRgb = options.avoidColor ? parseCssColor(options.avoidColor) : null;

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

function parseCssColor(value: string): RgbColor | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "white") return { r: 255, g: 255, b: 255 };
  if (normalized === "black") return { r: 0, g: 0, b: 0 };
  if (normalized.startsWith("#")) return parseHexColor(normalized);
  if (normalized.startsWith("rgb")) return parseRgbColor(normalized);
  if (normalized.startsWith("hsl")) return parseHslColor(normalized);
  return null;
}

function parseHexColor(value: string): RgbColor | null {
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

function parseRgbColor(value: string): RgbColor | null {
  const parts = value.match(/[\d.]+%?/g);
  if (!parts || parts.length < 3) return null;
  const [r, g, b] = parts;
  return {
    r: parseRgbChannel(r),
    g: parseRgbChannel(g),
    b: parseRgbChannel(b),
  };
}

function parseRgbChannel(value: string) {
  if (value.endsWith("%")) return clamp(Math.round((Number.parseFloat(value) / 100) * 255), 0, 255);
  return clamp(Math.round(Number.parseFloat(value)), 0, 255);
}

function parseHslColor(value: string): RgbColor | null {
  const parts = value.match(/[-\d.]+%?/g);
  if (!parts || parts.length < 3) return null;
  const hue = Number.parseFloat(parts[0]);
  const saturation = Number.parseFloat(parts[1]) / 100;
  const lightness = Number.parseFloat(parts[2]) / 100;
  if ([hue, saturation, lightness].some(Number.isNaN)) return null;
  return hslToRgb({ h: hue, s: saturation, l: lightness });
}

function hslToRgb({ h, s, l }: HslColor): RgbColor {
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

function hueToRgb(p: number, q: number, t: number) {
  let hue = t;
  if (hue < 0) hue += 1;
  if (hue > 1) hue -= 1;
  if (hue < 1 / 6) return p + (q - p) * 6 * hue;
  if (hue < 1 / 2) return q;
  if (hue < 2 / 3) return p + (q - p) * (2 / 3 - hue) * 6;
  return p;
}

function rgbToHsl({ r, g, b }: RgbColor): HslColor {
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

function isGreenishBackground(colors: RgbColor[]) {
  return colors.some((color) => {
    const hsl = rgbToHsl(color);
    return hsl.s > 0.28 && hsl.h >= GREEN_BACKGROUND_MIN_HUE && hsl.h <= GREEN_BACKGROUND_MAX_HUE;
  });
}

function isYellowishColor(color: RgbColor) {
  const hsl = rgbToHsl(color);
  return hsl.s > 0.35 && hsl.h >= YELLOW_MIN_HUE && hsl.h <= YELLOW_MAX_HUE;
}

function getAverageHueDistance(color: RgbColor, backgroundColors: RgbColor[]) {
  const hue = rgbToHsl(color).h;
  const distances = backgroundColors.map((background) =>
    getHueDistance(hue, rgbToHsl(background).h),
  );
  return distances.reduce((sum, value) => sum + value, 0) / Math.max(distances.length, 1);
}

function getHueDistance(a: number, b: number) {
  const distance = Math.abs(a - b) % 360;
  return Math.min(distance, 360 - distance);
}

function getColorDistance(a: RgbColor, b: RgbColor) {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

function getMinimumContrast(color: RgbColor, backgrounds: RgbColor[]) {
  return Math.min(...backgrounds.map((background) => getContrastRatio(color, background)));
}

function getMaximumLuminance(colors: RgbColor[]) {
  return Math.max(...colors.map(getRelativeLuminance));
}

function getContrastRatio(a: RgbColor, b: RgbColor) {
  const lighter = Math.max(getRelativeLuminance(a), getRelativeLuminance(b));
  const darker = Math.min(getRelativeLuminance(a), getRelativeLuminance(b));
  return (lighter + 0.05) / (darker + 0.05);
}

function getRelativeLuminance({ r, g, b }: RgbColor) {
  const [red, green, blue] = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
