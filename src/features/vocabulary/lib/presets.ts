/** Curated vocabulary color/motion presets. Exports: THEMES, STYLES, DOUYIN_THEMES, DOUYIN_STYLES, themePool, stylePool, choosePresentation. Depends on: canvas palettes, stable hash. */
import {
  DEFAULT_CANVAS,
  PALETTES,
  ensureReadablePalette,
  normalizePalette,
  paletteBackgroundStops,
  vividGradient,
  type CanvasSpec,
  type Palette,
  type PaletteTone,
} from "@/features/canvas";
import { getRelativeLuminance } from "@/features/canvas/contrast/color-math";
import {
  getHanLayoutMetrics,
  getHanTokens,
  getVietnameseLayoutMetrics,
  getWords,
  isLikelyChineseText,
  isLikelyVietnameseText,
  type EmphasisVariant,
} from "@/features/kinetic-text";
import { getTextSafeInsets } from "@/features/post-player/lib/playback-timing";
import { getClueBandStretch } from "./landscape-geometry";
import type { NarrativeStyle } from "./schema";
import { hash } from "./random";
import { pickHandwritingFont } from "./handwriting";
import type { Presentation, VisualDialect } from "../types";

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

/**
 * Relative-luminance floor above which a backdrop is treated as pale. The curated light
 * palettes average well above this (their palest stops sit near 0.7), while every deep or
 * saturated backdrop — even a bright-hued olive, jade or lagoon — averages far below it,
 * so the split is unambiguous and never depends on a hand-authored flag staying current.
 */
const LIGHT_BACKDROP_MIN_LUMINANCE = 0.42;

/**
 * Categorize a backdrop as deep ("dark") or pale ("light") from the actual luminance of
 * its own color stops, rather than trusting the palette's stored `tone`. The floating
 * chrome — the top-bar scrim, the icon ink, the word's text-shadow — follows this value,
 * so it now tracks what the card really paints. An admin who edits a gradient (or tags a
 * dark palette `light`) can no longer leave a white veil sitting over a deep background:
 * the tone is re-derived from the pixels on screen.
 * @pure true
 */
function classifyBackdropTone(background: string): PaletteTone {
  const stops = paletteBackgroundStops(background);
  if (!stops.length) return "dark";
  const average = stops.reduce((sum, stop) => sum + getRelativeLuminance(stop), 0) / stops.length;
  return average >= LIGHT_BACKDROP_MIN_LUMINANCE ? "light" : "dark";
}

// The theme list IS the palette collection: no accent is derived at runtime from
// whatever stop happens to be brightest, which is what used to pair a pale
// background with white ink and an unrelated fallback highlight.
function paletteToTheme(palette: Palette): VocabularyTheme {
  return {
    id: palette.id,
    label: palette.label,
    background: palette.background,
    paint: vividGradient(palette.background),
    // Chrome follows the measured backdrop, not the authored flag, so an edited or
    // mis-tagged gradient can't put a light veil over a dark card.
    tone: classifyBackdropTone(palette.background),
    ink: palette.ink,
    accent: palette.accentA,
    accentAlt: palette.accentB,
    onAccent: palette.onAccent,
    font: palette.font,
    canvas: {
      backgroundStyle: "transition" as const,
      gradientPath: [palette.background, reversedGradient(palette.background)],
    },
  };
}

export const THEMES: VocabularyTheme[] = PALETTES.map(paletteToTheme);

/**
 * The Douyin-dialect palettes: color stories mainland short-video readers read as
 * "native" — the original five lean Douyin-tech and 国潮, the second five pull
 * from deeper Eastern artifacts (水墨 ink-wash, 青瓷 Song celadon, 朱砂 cinnabar
 * seal paste, 青花 Jingdezhen porcelain, 梅 plum blossoms). Hand-authored rows,
 * repaired on load through the exact same contrast pipeline as the main
 * collection, so a floor violation can never reach the screen;
 * scripts/check-douyin-presets.ts asserts the raw rows already pass, keeping the
 * authored colors identical to the shipped ones.
 * These never join THEMES: the default pool stays untouched on every host.
 */
export const DOUYIN_PALETTE_ROWS: Palette[] = [
  {
    id: "douyin-neon",
    label: "Douyin neon",
    mood: "signal cyan and douyin red crossing a steel-dark stage",
    scheme: "complementary",
    tone: "dark",
    hue: 210,
    background: "linear-gradient(135deg,#33445f,#7d1a3d)",
    ink: "#f4f7fb",
    accentA: "#25f4ee",
    accentB: "#ff4d6d",
    onAccent: "#14101f",
    font: "Space Grotesk",
  },
  {
    id: "guochao-red",
    label: "Guochao red",
    mood: "imperial gold and jade light over deep lacquer red",
    scheme: "complementary",
    tone: "dark",
    hue: 352,
    background: "linear-gradient(160deg,#8a1f2d,#14544a)",
    ink: "#fdf4e7",
    accentA: "#f5c542",
    accentB: "#6fe3c4",
    onAccent: "#14101f",
    font: "Playfair Display",
  },
  {
    id: "neon-night",
    label: "Neon night",
    mood: "hot magenta and electric cyan over club violet",
    scheme: "split",
    tone: "dark",
    hue: 280,
    background: "linear-gradient(135deg,#5c2185,#a51245)",
    ink: "#f8f4ff",
    accentA: "#ff77dd",
    accentB: "#22e6ff",
    onAccent: "#14101f",
    font: "Space Grotesk",
  },
  {
    id: "jade-mist",
    label: "Jade mist",
    mood: "seal vermilion and pine green over pale celadon",
    scheme: "complementary",
    tone: "light",
    hue: 150,
    background: "linear-gradient(150deg,#e9f2e8,#d8e6f2)",
    ink: "#14281f",
    accentA: "#c53020",
    accentB: "#1f6f57",
    onAccent: "#ffffff",
    font: "Inter",
  },
  {
    id: "ink-gold",
    label: "Ink gold",
    mood: "molten gold and jade over bronze lacquer",
    scheme: "split",
    tone: "dark",
    hue: 42,
    background: "linear-gradient(150deg,#57431a,#14514f)",
    ink: "#f5ead2",
    accentA: "#e8b34b",
    accentB: "#4fd1b4",
    onAccent: "#14101f",
    font: "Inter",
  },
  {
    id: "ink-landscape",
    label: "Ink landscape",
    mood: "ink-wash mountain silhouettes over warm rice paper",
    scheme: "complementary",
    tone: "light",
    hue: 35,
    background: "linear-gradient(150deg,#e8dcc4,#b8c2c8)",
    ink: "#1a1410",
    accentA: "#a83028",
    accentB: "#2e5a4a",
    onAccent: "#ffffff",
    font: "Playfair Display",
  },
  {
    id: "celadon-blue",
    label: "Celadon blue",
    mood: "Song celadon glaze with seal vermilion and pine",
    scheme: "split",
    tone: "light",
    hue: 155,
    background: "linear-gradient(150deg,#cfe0d6,#88a8c4)",
    ink: "#0f2a22",
    accentA: "#902418",
    accentB: "#185848",
    onAccent: "#ffffff",
    font: "Inter",
  },
  {
    id: "cinnabar-gold",
    label: "Cinnabar gold",
    mood: "cinnabar seal paste and temple gold over lacquer",
    scheme: "complementary",
    tone: "dark",
    hue: 8,
    background: "linear-gradient(150deg,#7a2323,#14483f)",
    ink: "#faecc8",
    accentA: "#e8b34b",
    accentB: "#6fe3c4",
    onAccent: "#14101f",
    font: "Playfair Display",
  },
  {
    id: "porcelain-blue",
    label: "Porcelain blue",
    mood: "Jingdezhen cobalt over white clay with warm accent",
    scheme: "split",
    tone: "dark",
    hue: 215,
    background: "linear-gradient(150deg,#1a4478,#84591d)",
    ink: "#f4f1e6",
    accentA: "#daaf65",
    accentB: "#8bbbe1",
    onAccent: "#14101f",
    font: "Inter",
  },
  {
    id: "plum-blossom",
    label: "Plum blossom",
    mood: "winter plum over ink branch with gold and pink",
    scheme: "split",
    tone: "dark",
    hue: 330,
    background: "linear-gradient(150deg,#731a5c,#1b6054)",
    ink: "#fbe8d8",
    accentA: "#e8b34b",
    accentB: "#ee87a2",
    onAccent: "#14101f",
    font: "Playfair Display",
  },
  // 春节 / Chūnjié — Chinese New Year: crimson lanterns, temple gold, rice-paper
  // cream. Three palettes lean heavy on red and yellow with a light paper-cut
  // variant on the cream side, so the reader can pick whichever register fits the
  // card.
  {
    id: "spring-crimson",
    label: "Spring crimson",
    mood: "imperial crimson and old-brass gold over lacquer night",
    scheme: "complementary",
    tone: "dark",
    hue: 345,
    background: "linear-gradient(155deg,#8b1a48,#5a4820)",
    ink: "#fdf3d1",
    accentA: "#f5c542",
    accentB: "#ff8f8f",
    onAccent: "#14101f",
    font: "Playfair Display",
  },
  {
    id: "hongbao-gold",
    label: "Hongbao gold",
    mood: "red envelope with foil-sealed gold and a spark of coral",
    scheme: "complementary",
    tone: "dark",
    hue: 350,
    background: "linear-gradient(150deg,#a01c48,#6a5820)",
    ink: "#fff7d1",
    accentA: "#ffd23f",
    accentB: "#ffa0a0",
    onAccent: "#14101f",
    font: "Space Grotesk",
  },
  {
    id: "lantern-paper-cut",
    label: "Lantern paper-cut",
    mood: "cut-red lantern paste on cream rice paper with pine accent",
    scheme: "complementary",
    tone: "light",
    hue: 40,
    background: "linear-gradient(155deg,#fef1c4,#e898b8)",
    ink: "#1f0f14",
    accentA: "#7a1a4e",
    accentB: "#5a4820",
    onAccent: "#ffffff",
    font: "Playfair Display",
  },
];

const DOUYIN_PALETTES: Palette[] = DOUYIN_PALETTE_ROWS.map((palette) =>
  ensureReadablePalette(normalizePalette(palette)),
);

/** The zh-only theme pool: Douyin-flavored colors, same validated role contract. */
export const DOUYIN_THEMES: VocabularyTheme[] = DOUYIN_PALETTES.map(paletteToTheme);

export type StylePreset = {
  id: NarrativeStyle;
  label: string;
  caption: string;
  /**
   * The highlight effects this reveal may draw from. A style used to own only
   * choreography, and the emphasis effect came from one global pool hashed over every
   * surface — so the highlight was a property of the WORD, and no two styles could look
   * different however their motion differed. Authoring a short pool per style makes the
   * effect a property of the STYLE: `Minimal` drawing no mover at all is the test of it.
   * Absent means the unfiltered global pool, which is what every other surface uses.
   */
  emphasis?: readonly EmphasisVariant[];
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
    // A gliding shine and a beat-brighten: clues, so it should draw the eye along, not shake.
    emphasis: ["sweep", "flash", "underline", "color"],
  },
  {
    id: "speed",
    label: "Speed",
    caption: "A quick word break",
    entrance: "scale",
    loop: "pulse",
    tempo: "snappy",
    rhythm: "burst",
    // Hard movers only — this style's whole identity is that it arrives fast.
    emphasis: ["fringe", "pulse", "jiggle", "color"],
  },
  {
    id: "confession",
    label: "Confession",
    caption: "A feeling you know",
    entrance: "scale",
    loop: "float",
    tempo: "steady",
    rhythm: "smooth",
    // Soft and luminous. `outline` is deliberately absent: the hollow-word draw strokes
    // glyph contours, and a Vietnamese syllable is a base letter plus its tone marks,
    // each outlined separately. It belongs to the Han dialect, which keeps it below.
    emphasis: ["glow", "halo", "underline"],
  },
  {
    id: "minimal",
    label: "Minimal",
    caption: "A little room to think",
    entrance: "fade",
    loop: "float",
    tempo: "steady",
    rhythm: "smooth",
    // Nothing moves. If this row animates, the authored pool is not being honoured.
    emphasis: ["color", "underline"],
  },
];

/**
 * The Douyin-dialect motion presets: the same four style slots readers already know,
 * re-choreographed to mainland short-video grammar — 卡点 beat-cut snapping (scale-in,
 * shake loop, burst rhythm), suspense blur-ins, slow emotional drift, and a composed
 * 国潮 slide. Reusing the NarrativeStyle ids keeps deck-authored styles, the
 * `Presentation.style` contract and buildStages untouched; only the motion and the
 * Vietnamese names swap when the dialect does.
 */
export const DOUYIN_STYLES: StylePreset[] = [
  {
    id: "detective",
    label: "Suspense",
    caption: "A slow-burn reveal",
    entrance: "blur",
    loop: "none",
    tempo: "steady",
    rhythm: "smooth",
    // The hollow word fills as the blur lifts: one slow reveal, no jitter. `outline` is
    // kept here because a Han glyph IS one contour — the one script the stroke suits.
    // The gate in getEmphasisVariant still drops it on any Latin run this pool dresses.
    emphasis: ["outline", "halo", "underline"],
  },
  {
    id: "speed",
    label: "Beat drop",
    caption: "Cut on the beat",
    entrance: "scale",
    loop: "shake",
    tempo: "snappy",
    rhythm: "burst",
    // 卡点: the tear and the shake are the cut.
    emphasis: ["fringe", "pulse", "jiggle"],
  },
  {
    id: "confession",
    label: "Heartfelt",
    caption: "Feelings first",
    entrance: "fade",
    loop: "float",
    tempo: "slow",
    rhythm: "poetic",
    emphasis: ["glow", "halo", "sweep"],
  },
  {
    id: "minimal",
    label: "Guochao",
    caption: "Ink and gold, composed",
    entrance: "slide",
    loop: "none",
    tempo: "steady",
    rhythm: "stagger",
    // The one slot allowed a box: 国潮 reads as a seal, and a lone word can spare the room.
    emphasis: ["color", "underline", "frame"],
  },
];

/**
 * The style presets a card may wear for a given dialect.
 * @pure (module-level registries only)
 */
export function stylePool(dialect?: VisualDialect): StylePreset[] {
  return dialect === "douyin" ? DOUYIN_STYLES : STYLES;
}

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
/** Em of height one line of clue text is budgeted at when a size is chosen for a page. */
export const VOCAB_TEXT_BUDGET_LINE_EM = 1.6;

/**
 * Vertical room a card grants its clue text.
 * @param width - card (or export text box) width
 * @param height - card (or export text box) height
 * @param reservedHeight - space the text may not use; see fitVocabularyTextSize
 * @returns Height in px the text block is budgeted to stay within
 * @pure true
 */
export function getVocabularyTextHeightBudget(
  width: number,
  height: number,
  reservedHeight = FEED_CHROME_HEIGHT,
): number {
  // `FEED_CHROME_HEIGHT` is an absolute measurement taken on the tall portrait card, where
  // 320px is only a few tenths of the height. A card wider than it is tall is barely half as
  // tall, so that same reservation would eat most of the display and collapse the clue text to
  // its floor — the layout that looks broken the moment the reader rotates. The clue's final
  // size is then pinned by the fit solver's legibility floor (it will not shrink text already
  // under MIN_FONT_SIZE), so the size chosen here has to fit the band the solver will actually
  // hand the text. On a wide card the stylesheet stretches the clue band so the solver's
  // bottom margin ends on the real chrome (getClueBandStretch), so what is reserved is the
  // solver's own safe insets of THAT band, less the stretch — never more than the caller
  // asked, so portrait and export (which passes 0) are byte-for-byte unchanged.
  if (width <= height) return Math.max(100, height - reservedHeight);
  const stretch = getClueBandStretch(height);
  const insets = getTextSafeInsets(height + stretch);
  const chrome = Math.min(reservedHeight, insets.top + insets.bottom - stretch);
  return Math.max(100, height - chrome);
}

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
  const availableHeight = getVocabularyTextHeightBudget(width, height, reservedHeight);
  const availableWidth = Math.max(180, width * 0.84);
  const vietnamese = isLikelyVietnameseText(text);
  // A Han deck's usage sentence packs through the same staggered-line renderer as
  // Vietnamese, so its size must be solved against the same packed line count.
  const han = !vietnamese && isLikelyChineseText(text);
  const tokens = han ? getHanTokens(text) : words;
  for (let size = baseSize; size >= 28; size -= 2) {
    let lines = 1;
    if (vietnamese || han) {
      lines = han
        ? getHanLayoutMetrics(tokens, width, size, 1.24).lines.length
        : getVietnameseLayoutMetrics(tokens, width, size, 1.24).lines.length;
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
    if (lines * size * VOCAB_TEXT_BUDGET_LINE_EM <= availableHeight) return size;
  }
  return 28;
}

/** Cached so a handwriting card's theme keeps one identity and its memoised canvas stays put. */
const handwritingThemes = new Map<string, VocabularyTheme>();

function withFont(theme: VocabularyTheme, font: string | null): VocabularyTheme {
  if (!font || font === theme.font) return theme;
  const key = `${theme.id}:${font}`;
  let next = handwritingThemes.get(key);
  if (!next) {
    next = { ...theme, font };
    handwritingThemes.set(key, next);
  }
  return next;
}

/**
 * The themes a card may actually wear for a given `Presentation.theme` choice.
 * The choice is the picker's allow-list — "mix" (everything), one id, or a
 * comma-joined set of ids the reader left picked. An unparseable or emptied
 * list falls back to the full collection so the stream can never go colorless.
 * The dialect picks the collection the allow-list is read against: a Douyin
 * stream never rotates into a default palette, and vice versa.
 * @pure (depends only on the module-level theme registries)
 */
export function themePool(theme: string, dialect?: VisualDialect): VocabularyTheme[] {
  const collection = dialect === "douyin" ? DOUYIN_THEMES : THEMES;
  const ids = theme
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (!ids.length || ids.includes("mix")) return collection;
  const picked = collection.filter((item) => ids.includes(item.id));
  return picked.length ? picked : collection;
}

/**
 * Choose appearance independently of word order. Every 5–7 cards the palette's font
 * gives way to a handwriting face; colors and motion are untouched.
 * @param occurrence Stable occurrence. @param choice Visitor overrides.
 * @param position Absolute stream position; omitted, no handwriting accent is applied.
 * @returns Theme/style.
 */
export function choosePresentation(occurrence: string, choice: Presentation, position?: number) {
  // A single-theme pick still locks (a one-item pool always lands on it); a
  // multi-theme pick keeps the per-card surprise of mix inside the picked subset.
  const pool = themePool(choice.theme, choice.dialect);
  const theme = pool[hash(`${occurrence}:theme`) % pool.length];
  const styles = stylePool(choice.dialect);
  return {
    // The handwriting surprise is part of the DEFAULT dialect's charm; a Douyin
    // stream keeps its own clean faces on every card.
    theme:
      choice.dialect === "douyin" || position === undefined
        ? theme
        : withFont(theme, pickHandwritingFont(occurrence, position)),
    style:
      styles.find((style) => style.id === choice.style) ??
      styles[hash(`${occurrence}:style`) % styles.length],
  };
}
