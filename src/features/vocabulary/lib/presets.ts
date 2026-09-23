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
  accent: "#06FFA5",
  font: ["Space Grotesk", "Inter", "Playfair Display"][index % 3],
});

// Use the original player/studio catalogs, keeping every design selectable.
export const THEMES: VocabularyTheme[] = [
  ...TRANSITION_GRADIENT_PATHS.map((path, index) => ({
    ...typography(index),
    id: path.id,
    label: path.label,
    background: path.gradients[0],
    canvas: { backgroundStyle: "transition" as const, gradientPath: [...path.gradients] },
  })),
  ...Array.from(new Set(GRADIENTS)).map((background, index) => ({
    ...typography(index),
    id: `gradient-${index}`,
    label: `Original gradient ${index + 1}`,
    background,
  })),
  ...CANVAS_SCENE_THEMES.map((scene, index) => ({
    ...typography(index),
    id: scene.id,
    label: scene.label,
    background: scene.base,
    canvas: { backgroundScene: scene.id },
  })),
  ...CANVAS_PATTERN_THEMES.map((pattern, index) => ({
    ...typography(index),
    id: pattern.id,
    label: pattern.label,
    background: pattern.base,
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
