/** Curated vocabulary color/motion presets. Exports: THEMES, STYLES, choosePresentation. Depends on: canvas palettes, stable hash. */
import {
  DEFAULT_CANVAS,
  PALETTES,
  vividGradient,
  type CanvasSpec,
  type PaletteTone,
} from "@/features/canvas";
import {
  getVietnameseLayoutMetrics,
  getWords,
  isLikelyVietnameseText,
} from "@/features/kinetic-text";
import type { NarrativeStyle } from "./schema";
import { hash } from "./random";
import type { Presentation } from "../types";

/**
 * One selectable appearance for a card. Every color role comes from a single
 * validated palette, so the body text, the two highlights and the label color
 * used on an accent fill are guaranteed legible together rather than picked
 * independently per theme.
 */
export type VocabularyTheme = {
  id: string;
  label: string;
  background: string;
  /**
   * `background` re-expressed as a perceptual blend, for PAINTING only. The stored
   * two-stop gradient stays the source of truth for every contrast calculation;
   * this is what the card actually shows, so its middle keeps its color instead of
   * passing through grey.
   */
  paint: string;
  /** Whether the backdrop is deep or pale; chrome, scrims and shadows follow it. */
  tone: PaletteTone;
  /** Body text color. */
  ink: string;
  /** Primary highlight: emphasized words, active controls. */
  accent: string;
  /** Secondary highlight: progress, dividers, secondary emphasis. */
  accentAlt: string;
  /** Text color that sits on an accent fill. */
  onAccent: string;
  font: string;
  canvas?: Pick<
    CanvasSpec,
    "backgroundStyle" | "gradientPath" | "backgroundPattern" | "backgroundScene"
  >;
};

/**
 * Swap a two-stop gradient's stops so the per-page transition sweep has somewhere
 * to travel while staying inside the same palette. Falls back to the input for
 * any background that is not a plain two-stop linear gradient.
 * @param background CSS gradient from a palette
 * @returns The same gradient with its stops reversed
 * @pure true
 */
function reversedGradient(background: string): string {
  const match = /^linear-gradient\(([^,]+),([^,]+),([^)]+)\)$/.exec(background.trim());
  if (!match) return background;
  return `linear-gradient(${match[1]},${match[3]},${match[2]})`;
}

// The theme list IS the palette collection: no accent is derived at runtime from
// whatever stop happens to be brightest, which is what used to pair a pale
// background with white ink and an unrelated fallback highlight.
export const THEMES: VocabularyTheme[] = PALETTES.map((palette) => ({
  id: palette.id,
  label: palette.label,
  background: palette.background,
  paint: vividGradient(palette.background),
  tone: palette.tone,
  ink: palette.ink,
  accent: palette.accentA,
  accentAlt: palette.accentB,
  onAccent: palette.onAccent,
  font: palette.font,
  canvas: {
    backgroundStyle: "transition" as const,
    gradientPath: [palette.background, reversedGradient(palette.background)],
  },
}));
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

/**
 * Reading air for the card's kinetic lines. The shared feed renderer sets display
 * typography deliberately tight (1.04 for Vietnamese, 0.9 for Latin) because it owns
 * multi-page posts; a riddle card is read once, standing still, so it gets 20% more
 * line-to-line advance than that default. Applied to both halves of the line pitch
 * (line height and the explicit per-line margin), so 1.2 is what the reader measures.
 */
export const VOCAB_LINE_SPACING_SCALE = 1.2;

/** Height the feed's own overlay controls take out of a card (toolbar above, actions below). */
const FEED_CHROME_HEIGHT = 320;

/**
 * Reserve the overlay controls before passing type to the original canvas fitter.
 * @param reservedHeight - vertical space the text may not use. Defaults to the feed's
 *   own chrome; a caller that has already carved out its text area (video export)
 *   passes 0 along with that area's height.
 */
export function fitVocabularyTextSize(
  text: string,
  baseSize: number,
  width: number,
  height: number,
  reservedHeight = FEED_CHROME_HEIGHT,
) {
  const words = getWords(text);
  const availableHeight = Math.max(100, height - reservedHeight);
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
