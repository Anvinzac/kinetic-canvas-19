/**
 * Pure helpers for emphasis.
 *
 * Exports: EMPHASIS_VARIANTS, NON_LUMINOUS_EMPHASIS_VARIANTS, EmphasisVariant, getEmphasisVariant, getRunEmphasisStyle, isDimEmphasisColor, getEmphasisTextShadow, getEmphasisInnerAnimation, getAuraColor, isWhiteLikeColor
 * Depends on: ./stable-hash
 */

import { getStableNumber } from "./stable-hash";

/**
 * How much larger an emphasised word is drawn than the text around it.
 *
 * Applied via `font-size` rather than `transform: scale`, so the extra width occupies
 * real layout space and an enlarged word cannot overlap its neighbours. It is declared
 * on the GLYPH span alone — never on a box that also carries spacing — or every `em`
 * length on that box (a margin, an effect's padding, an underline's thickness) would
 * silently come out this much longer than it was written.
 *
 * One definition on purpose: the feed and the preview each used to carry their own
 * literal, 1.12 and 1.08, which is the same design idea written twice and drifted.
 */
export const EMPHASIS_FONT_SCALE = 1.12;

export const EMPHASIS_VARIANTS = [
  "color",
  "sweep",
  "glow",
  "underline",
  "jiggle",
  "pulse",
  "halo",
  "frame",
  "outline",
  "fringe",
  "flash",
] as const;

// glow and halo are luminous auras — they only read well on bright colors. On a
// dim/dark emphasis color they turn into an ugly muddy blob, so those colors get
// the non-luminous set only. sweep is a recolor + gliding shine, so it reads on
// any color.
//
// outline, fringe and flash are NOT auras and belong in this set: outline is a stroke
// plus a text-clipped fill (nothing blurred behind the word), fringe is a drop-shadow
// offset that decays to zero, flash is a brightness swell capped at 1.55. Leaving them
// out would let the dim-palette filter erase a style's own effect and quietly fall back
// to something else. `outline` stays listed here because this set is about LUMINOSITY
// only; whether it may be drawn at all is a separate question about the script, decided
// by the glyph-stroke gate in getEmphasisVariant.
export const NON_LUMINOUS_EMPHASIS_VARIANTS = [
  "color",
  "sweep",
  "underline",
  "jiggle",
  "pulse",
  "frame",
  "outline",
  "fringe",
  "flash",
] as const;

export type EmphasisVariant = (typeof EMPHASIS_VARIANTS)[number];

/**
 * Effects drawn by stroking the glyph's own contours (-webkit-text-stroke).
 *
 * These only read as "one hollow character filling in" when a character IS one shape.
 * A Han glyph is: it is drawn as a single dense block. Latin — and Vietnamese most of
 * all — is not. `ế` is a base `e` plus a circumflex plus an acute, three separate
 * contours, and the stroke outlines every one of them, so a tone mark grows its own
 * halo and the counters of `ổ` `ể` `đ` close up. The effect is not broken; it is being
 * asked to do something the script cannot support.
 */
export const GLYPH_STROKE_EMPHASIS_VARIANTS: readonly EmphasisVariant[] = ["outline"];

/** A Han character — the one script whose glyphs are a single unified shape. */
const HAN_GLYPH = /\p{Script=Han}/u;
/** Every Han glyph, so what is left can be tested for letters of any other script.
 *  Written as a strip-then-test rather than a set-difference class: the `v` flag that
 *  would express the difference directly is a parse error on older Safari, and a regex
 *  literal that fails to parse takes the whole module down with it. */
const HAN_GLYPHS = /\p{Script=Han}/gu;
const ANY_LETTER = /\p{L}/u;

/**
 * Whether text may be drawn with a contour-stroking effect.
 *
 * Deliberately strict rather than "mostly Han": the stroke is applied to the glyphs in
 * front of the reader, so ONE Latin letter in the run is one letter drawn badly. A run
 * qualifies only when it has a Han glyph and no letter of any other script.
 * @param text - the text the effect would be drawn on
 * @returns true when every letter in it is Han
 * @pure true
 */
export function isGlyphStrokeSafeText(text: string): boolean {
  return HAN_GLYPH.test(text) && !ANY_LETTER.test(text.replace(HAN_GLYPHS, ""));
}

/**
 * Pick a stable emphasis visual variant for a word/phrase anchor.
 * @param text - text argument
 * @param emphasisSeed - the run's own text. It seeds the hash AND is the text the
 *   effect will be drawn on, so the glyph-stroke gate reads its script from here
 * @param anchorIndex - anchorIndex argument
 * @param allowLuminous - allowLuminous argument
 * @param pool - the effects a surface has authored for this slot; the luminous gate
 *   FILTERS it rather than overriding it, so a dim palette can never be handed an aura
 * @returns One of EMPHASIS_VARIANTS (or the non-luminous subset)
 */
export function getEmphasisVariant(
  text: string,
  emphasisSeed: string,
  anchorIndex: number,
  allowLuminous: boolean,
  pool?: readonly EmphasisVariant[],
): EmphasisVariant {
  const nonLuminous: readonly EmphasisVariant[] = NON_LUMINOUS_EMPHASIS_VARIANTS;
  const requested: readonly EmphasisVariant[] =
    pool && pool.length > 0 ? pool : allowLuminous ? EMPHASIS_VARIANTS : nonLuminous;
  const allowed = allowLuminous ? requested : requested.filter((v) => nonLuminous.includes(v));
  // The script gate FILTERS, exactly as the luminous gate does, so neither an authored
  // pool nor the fallback below can hand a contour-stroking effect to a script whose
  // characters are not one shape. `emphasisSeed` is the run's own text at every call
  // site, which is what the effect would be drawn on.
  const drawable = (list: readonly EmphasisVariant[]) =>
    isGlyphStrokeSafeText(emphasisSeed)
      ? list
      : list.filter((v) => !GLYPH_STROKE_EMPHASIS_VARIANTS.includes(v));
  const usable = drawable(allowed);
  // A pool authored entirely out of auras still has to draw something on a dim color.
  const final = usable.length > 0 ? usable : drawable(nonLuminous);
  return final[getStableNumber(`${text}|${emphasisSeed}|${anchorIndex}`) % final.length];
}

/**
 * Detect dim/dark hex colors where glow/halo would look muddy.
 * @param color - color argument
 * @returns true when max RGB channel / 255 < 0.42
 */
export function isDimEmphasisColor(color: string): boolean {
  const hex = color.trim().replace(/^#/, "");
  const full = hex.length === 3 ? hex.replace(/(.)/g, "$1$1") : hex;
  if (full.length !== 6) return false;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return Math.max(r, g, b) / 255 < 0.42;
}

/**
 * The ONE effect a run of syllables is dressed with, hashed from the run itself.
 *
 * Seeding per syllable only agrees across a compound when a curated phrase list or an
 * annotation knows the pair; otherwise each half hashes its own token and a two-syllable
 * word shows two different effects. Anchoring on the run makes the group the unit. For a
 * phrase the helpers already recognise, this join is exactly the seed and anchor its
 * syllables agreed on, so a known compound keeps the effect it already had.
 * @param text - full page text, part of the stable seed
 * @param words - page tokens
 * @param indexes - token indexes of the run, in order
 * @param emphasisColor - the page's emphasis colour, which gates luminous effects
 * @param pool - the effects authored for this slot, if the surface has authored any
 * @returns The variant every syllable of the run is drawn with
 * @pure true
 */
export function getRunEmphasisStyle(
  text: string,
  words: readonly string[],
  indexes: readonly number[],
  emphasisColor: string,
  pool?: readonly EmphasisVariant[],
): EmphasisVariant {
  const syllables = indexes.map((index) => words[index] ?? "");
  const variant = getEmphasisVariant(
    text,
    syllables.join(" "),
    indexes[0] ?? 0,
    !isDimEmphasisColor(emphasisColor),
    pool,
  );
  // A grouped run shows the box-drawing `frame` as a continuous underline, never a box.
  // `outline` stays per-syllable for the same reason `frame` and `color` do: each syllable
  // is its own set of glyphs to stroke and fill, and one stroke across a spaced pair would
  // draw a hollow shape around the gap.
  return variant === "frame" ? "underline" : variant;
}

/**
 * Resolve text-shadow for an emphasis variant.
 * @param variant - variant argument
 * @returns CSS text-shadow string
 */
export function getEmphasisTextShadow(variant: EmphasisVariant | null): string {
  if (variant === "color") {
    return "0 4px 40px rgba(0,0,0,0.45)";
  }
  if (variant === "sweep") {
    return "0 0 22px rgba(255,255,255,0.3), 0 5px 36px rgba(0,0,0,0.55)";
  }
  if (variant === "halo") {
    return "0 4px 40px rgba(0,0,0,0.45)";
  }
  if (variant === "glow") {
    return "0 0 0.14em var(--kinetic-aura-color, #FFBE0B), 0 0 0.4em var(--kinetic-aura-color, #FFBE0B), 0 5px 30px rgba(0,0,0,0.5)";
  }
  if (variant === "frame") {
    return "0 2px 16px rgba(0,0,0,0.5)";
  }
  // A hollow word carrying a glow reads as a lit box, not as ink: the stroke is the whole
  // effect, so this variant deliberately keeps only the flat separation shadow.
  if (variant === "outline") {
    return "0 4px 40px rgba(0,0,0,0.45)";
  }
  return "0 0 22px rgba(255,255,255,0.35), 0 5px 36px rgba(0,0,0,0.55)";
}

/**
 * CSS animation for transform/filter emphasis variants (not halo/frame).
 * @param variant - variant argument
 * @returns CSS animation shorthand, or undefined
 */
export function getEmphasisInnerAnimation(variant: EmphasisVariant | null): string | undefined {
  if (variant === "jiggle") return "kinetic-emphasis-jiggle 0.58s ease-in-out 0.08s 2";
  // Looping variants are whole multiples of `--kinetic-beat` when a surface sets one,
  // so every mark on a page pulses to the same tempo. The fallbacks reproduce the
  // original free-running periods (1.35s and 1.6s) for surfaces that do not.
  if (variant === "pulse") {
    return "kinetic-emphasis-pulse calc(var(--kinetic-beat, 0.675s) * 2) ease-in-out infinite";
  }
  if (variant === "glow") {
    return "kinetic-emphasis-glow calc(var(--kinetic-beat, 0.8s) * 2) ease-in-out infinite";
  }
  // A one-shot tear that settles: it must not loop, or a clue sentence judders forever.
  if (variant === "fringe") {
    return "kinetic-emphasis-fringe calc(var(--kinetic-beat, 0.4s) * 1.5) ease-out 1";
  }
  // FLOORED on purpose. Everything else here scales with the beat, and a snappy card's
  // beat is 0.36s — a full brightness swell twice would land near 0.7s, i.e. ~1.4 Hz per
  // cycle but with the peak held for a third of it. `max(0.5s, …)` keeps the swell inside
  // the WCAG 3 Hz threshold on every tempo instead of letting the fastest one define it.
  if (variant === "flash") {
    return "kinetic-emphasis-flash max(0.5s, calc(var(--kinetic-beat, 0.675s) * 2)) ease-in-out infinite";
  }
  return undefined;
}

/**
 * Aura color for halo/glow — gold on white-like text, else currentColor.
 * @param textColor - textColor argument
 * @returns CSS color used by --kinetic-aura-color
 */
export function getAuraColor(textColor: string): string {
  return isWhiteLikeColor(textColor) ? "#FFBE0B" : "currentColor";
}

/**
 * Detect white / near-white named or hex text colors.
 * @param color - color argument
 * @returns true for white, #fff, #ffffff
 */
export function isWhiteLikeColor(color: string): boolean {
  const normalized = color.trim().toLowerCase();
  return normalized === "white" || normalized === "#fff" || normalized === "#ffffff";
}
