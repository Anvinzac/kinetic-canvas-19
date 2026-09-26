/** Curated vocabulary color/motion presets. Exports: THEMES, STYLES, choosePresentation. Depends on: canvas types, stable hash. */
import {
  CANVAS_PATTERN_THEMES,
  CANVAS_SCENE_THEMES,
  DEFAULT_CANVAS,
  GRADIENTS,
  TRANSITION_GRADIENT_PATHS,
  type CanvasSpec,
} from "@/features/canvas";
import {
  getVietnameseLayoutMetrics,
  getWords,
  isLikelyVietnameseText,
} from "@/features/kinetic-text";
import type { NarrativeStyle } from "./schema";
import { hash } from "./random";
import type { Presentation } from "../types";

export type VocabularyTheme = {
  id: string;
  label: string;
  background: string;
  ink: string;
  accent: string;
  font: string;
  canvas?: Pick<
    CanvasSpec,
    "backgroundStyle" | "gradientPath" | "backgroundPattern" | "backgroundScene"
  >;
};
const typography = (index: number) => ({
  ink: "#ffffff",
  font: ["Space Grotesk", "Inter", "Playfair Display"][index % 3],
});

/** Bright accents used only when a theme's own palette yields no usable highlight. */
const ACCENT_FALLBACKS = ["#FFD60A", "#06FFA5", "#00E5FF", "#FF7AC6", "#B6FF3D", "#FFB703"];

/** Relative luminance of a #rgb/#rrggbb color for contrast-aware accent selection. @pure true */
function luminance(hex: string): number {
  const raw = hex.replace("#", "");
  const full = raw.length === 3 ? raw.replace(/(.)/g, "$1$1") : raw.slice(0, 6);
  const channel = (offset: number) => {
    const value = parseInt(full.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/**
 * Derive a per-theme accent from the theme's own background so highlights harmonize
 * and stay legible against white ink, instead of shipping one fixed accent for all.
 * @param background - the theme gradient/base color
 * @param index - theme index, used only for the fallback palette
 * @returns A bright accent color drawn from the theme palette
 * @pure true
 */
function accentFor(background: string, index: number): string {
  const colors = background.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
  if (colors.length) {
    const brightest = colors.reduce((best, color) =>
      luminance(color) > luminance(best) ? color : best,
    );
    const light = luminance(brightest);
    // Only reuse a palette color when it is bright enough to read as a highlight on the
    // (usually dark) card yet distinct from the white ink. Dark or near-white stops — e.g.
    // solid scene/pattern bases — fall back to a guaranteed-bright accent instead.
    if (light >= 0.3 && light < 0.92) return brightest;
  }
  return ACCENT_FALLBACKS[index % ACCENT_FALLBACKS.length];
}

// Use the original player/studio catalogs, keeping every design selectable.
export const THEMES: VocabularyTheme[] = [
  ...TRANSITION_GRADIENT_PATHS.map((path, index) => ({
    ...typography(index),
    id: path.id,
    label: path.label,
    background: path.gradients[0],
    accent: accentFor(path.gradients[0], index),
    canvas: { backgroundStyle: "transition" as const, gradientPath: [...path.gradients] },
  })),
  ...Array.from(new Set(GRADIENTS)).map((background, index) => ({
    ...typography(index),
    id: `gradient-${index}`,
    label: `Original gradient ${index + 1}`,
    background,
    accent: accentFor(background, index),
  })),
  ...CANVAS_SCENE_THEMES.map((scene, index) => ({
    ...typography(index),
    id: scene.id,
    label: scene.label,
    background: scene.base,
    accent: accentFor(scene.base, index),
    canvas: { backgroundScene: scene.id },
  })),
  ...CANVAS_PATTERN_THEMES.map((pattern, index) => ({
    ...typography(index),
    id: pattern.id,
    label: pattern.label,
    background: pattern.base,
    accent: accentFor(pattern.base, index),
    canvas: { backgroundPattern: pattern.id },
  })),
];
export type StylePreset = {
  id: NarrativeStyle;
  label: string;
  caption: string;
} & Pick<CanvasSpec, "entrance" | "loop" | "tempo" | "rhythm">;
export const STYLES: StylePreset[] = [
  {
    id: "detective",
    label: "Detective",
    caption: "Follow the clues",
    entrance: "slide",
    loop: "float",
    tempo: "steady",
    rhythm: "stagger",
  },
  {
    id: "speed",
    label: "Speed",
    caption: "A quick word break",
    entrance: "scale",
    loop: "pulse",
    tempo: "snappy",
    rhythm: "burst",
  },
  {
    id: "confession",
    label: "Confession",
    caption: "A feeling you know",
    entrance: "scale",
    loop: "float",
    tempo: "steady",
    rhythm: "smooth",
  },
  {
    id: "minimal",
    label: "Minimal",
    caption: "A little room to think",
    entrance: "fade",
    loop: "float",
    tempo: "steady",
    rhythm: "smooth",
  },
];

/** Build a player spec with the original canvas defaults and selected backdrop. */
export function buildVocabularyCanvas(theme: VocabularyTheme, style: StylePreset): CanvasSpec {
  return {
    ...DEFAULT_CANVAS,
    ...theme.canvas,
    text: "",
    font: theme.font,
    color: theme.ink,
    size: 96,
    weight: 800,
    letterSpacing: -0.02,
    entrance: style.entrance,
    loop: style.loop,
    tempo: style.tempo,
    rhythm: style.rhythm,
  };
}

/** Reserve the overlay controls before passing type to the original canvas fitter. */
export function fitVocabularyTextSize(
  text: string,
  baseSize: number,
  width: number,
  height: number,
) {
  const words = getWords(text);
  const availableHeight = Math.max(100, height - 320);
  const availableWidth = Math.max(180, width * 0.84);
  const vietnamese = isLikelyVietnameseText(text);
  for (let size = baseSize; size >= 28; size -= 2) {
    let lines = 1;
    if (vietnamese) {
      lines = getVietnameseLayoutMetrics(words, width, size, 1.24).lines.length;
    } else {
      let used = 0;
      for (const word of words) {
        const advance = (word.length * 0.62 + 0.4) * size;
        if (used && used + advance > availableWidth) {
          lines += 1;
          used = 0;
        }
        used += advance;
      }
    }
    if (lines * size * 1.6 <= availableHeight) return size;
  }
  return 28;
}

/** Choose appearance independently of word order. @param occurrence Stable occurrence. @param choice Visitor overrides. @returns Theme/style. */
export function choosePresentation(occurrence: string, choice: Presentation) {
  return {
    theme:
      THEMES.find((theme) => theme.id === choice.theme) ??
      THEMES[hash(`${occurrence}:theme`) % THEMES.length],
    style:
      STYLES.find((style) => style.id === choice.style) ??
      STYLES[hash(`${occurrence}:style`) % STYLES.length],
  };
}
