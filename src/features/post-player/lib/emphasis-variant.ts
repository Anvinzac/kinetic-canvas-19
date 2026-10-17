/**
 * Which emphasis effect a word is drawn with, and whether a run of emphasised
 * words should carry that effect once, as a whole.
 *
 * A Vietnamese word is often two or three syllables written apart, and each
 * syllable is its own animated span. An effect that MOVES — a spotlight gliding
 * across, an aura breathing, a jiggle — played per syllable gives two small
 * effects running side by side instead of one passing over the word. Those effects
 * are lifted to the run: one sweep from the first syllable to the last.
 *
 * Exports: resolveWordEmphasisVariant, getRunEmphasis, avoidBlankUnderline, RUN_LEVEL_VARIANTS
 * Depends on: kinetic-text emphasis + bound-phrase helpers
 */

import {
  getBoundPhraseEmphasisSeed,
  getBoundPhraseStartIndex,
  GLYPH_STROKE_EMPHASIS_VARIANTS,
  getEmphasisVariant,
  getRunEmphasisStyle,
  isGlyphStrokeSafeText,
  isDimEmphasisColor,
  type EmphasisVariant,
} from "@/features/kinetic-text";

/**
 * Effects that are drawn once across a whole run instead of once per syllable.
 * `underline` is here because per-syllable bars read as separate strokes — a gradient
 * bar (the Douyin dialect) restarts its colors on every syllable. `frame` is absent
 * because a grouped frame is shown as that underline, and `color` because it does
 * not move.
 */
export const RUN_LEVEL_VARIANTS: readonly EmphasisVariant[] = [
  "sweep",
  "halo",
  "glow",
  "pulse",
  "jiggle",
  "underline",
  "flash",
  "fringe",
];

/** A masked answer slot ("_____"), which the vocabulary card draws with its own baseline bar. */
const BLANK_TOKEN = /_{2,}/;

/** What an underline becomes on a page that carries a blank: a shine, not another line. */
const BLANK_PAGE_UNDERLINE_SUBSTITUTE: EmphasisVariant = "sweep";

/**
 * True when this effect strokes glyph contours and the text cannot carry one.
 * @param variant - the effect a caller named outright
 * @param text - the text it would be drawn on
 * @pure true
 */
function isStrokeUnsafe(variant: EmphasisVariant, text: string): boolean {
  return GLYPH_STROKE_EMPHASIS_VARIANTS.includes(variant) && !isGlyphStrokeSafeText(text);
}

/**
 * Keep a page with an answer blank free of underline emphasis. The blank's slot bar and
 * an underlined neighbour sit on the same baseline a few px apart and read as one
 * tangled stroke, so the underline gives way to a non-linear effect.
 * @param variant - the effect resolved for a word or run
 * @param words - every token on the page
 * @returns The variant to draw
 * @pure true
 */
export function avoidBlankUnderline(
  variant: EmphasisVariant,
  words: readonly string[],
): EmphasisVariant {
  return variant === "underline" && words.some((word) => BLANK_TOKEN.test(word))
    ? BLANK_PAGE_UNDERLINE_SUBSTITUTE
    : variant;
}

export type WordEmphasisInput = {
  word: string;
  index: number;
  words: string[];
  /** Full page text; part of the stable seed so replays pick the same effect. */
  text: string;
  emphasized: Set<number>;
  phraseKeys?: readonly (readonly string[])[];
  secondaryEmphasized?: Set<number>;
  secondaryVariant?: EmphasisVariant;
  emphasisColor: string;
  /** The word sits inside a shared run, where a box-drawing frame is shown as an underline. */
  inRun: boolean;
  /**
   * Whether the box-drawing `frame` may be used at all. A surface that cannot spare the
   * room a box takes around a word (a landscape card, where height is the scarce
   * dimension) passes false and every frame is drawn as an underline instead — the same
   * substitution a shared run already makes. Defaults to allowed.
   */
  allowFrame?: boolean;
  /**
   * The effects this slot may draw from, authored per reveal style. Absent means the
   * global pool. The luminous gate filters this list rather than replacing it, so a
   * surface can narrow a style's effects but never force an aura onto a dim colour.
   */
  pool?: readonly EmphasisVariant[];
};

/**
 * Resolve the effect a single word is drawn with.
 * @returns The variant as displayed, or null when the word is not emphasised
 * @pure true
 */
export function resolveWordEmphasisVariant(input: WordEmphasisInput): EmphasisVariant | null {
  const { word, index, words, emphasized, phraseKeys, secondaryEmphasized, secondaryVariant } =
    input;
  // A token with no letter/number (punctuation, a masked "_____" blank) never counts
  // as emphasised, whichever selection path proposed it.
  if (!/\p{L}|\p{N}/u.test(word)) return null;
  const primary = emphasized.has(index);
  const secondary = !primary && (secondaryEmphasized?.has(index) ?? false);
  if (!primary && !secondary) return null;
  // A caller-named secondary effect skips the seeded pick, so the script gate has to be
  // applied here as well; otherwise an authored `outline` would reach Latin glyphs by
  // the one path that never consults the pool.
  const forced =
    secondary && secondaryVariant && !isStrokeUnsafe(secondaryVariant, word)
      ? secondaryVariant
      : null;
  const variant =
    forced ??
    getEmphasisVariant(
      input.text,
      getBoundPhraseEmphasisSeed(words, index, phraseKeys),
      getBoundPhraseStartIndex(words, index, phraseKeys),
      !isDimEmphasisColor(input.emphasisColor),
      input.pool,
    );
  const boxed = variant === "frame" && !input.inRun && input.allowFrame !== false;
  return avoidBlankUnderline(variant === "frame" && !boxed ? "underline" : variant, words);
}

/**
 * How a whole run draws its emphasis.
 * `style` is the ONE effect every syllable is dressed in — colour, weight, shadow and
 * class alike — so a two-syllable word can never show two different effects.
 * `lift` is the effect promoted onto the run as a single moving overlay, or null when
 * the style needs no overlay and each syllable simply draws that shared style itself.
 */
export type RunEmphasis = {
  style: EmphasisVariant;
  lift: EmphasisVariant | null;
};

/**
 * The effect a run of consecutive emphasised words should carry as one.
 *
 * A run whose syllables already agree keeps exactly that effect, so nothing about a
 * known compound changes. When they disagree, the seeding helper had never heard of
 * the pair — the selection glued it as a compound anyway — so the RUN becomes the
 * anchor: one effect is hashed from the syllables joined together at the run's first
 * index. Silently falling back to per-word drawing is what let a two-syllable word
 * render as two different effects.
 * @param indexes - word indexes of the run, in order
 * @param shared - the page-level inputs, without the per-word fields
 * @returns The run's shared style and its lifted overlay, or null when nothing is drawn
 * @pure true
 */
export function getRunEmphasis(
  indexes: readonly number[],
  shared: Omit<WordEmphasisInput, "word" | "index" | "inRun">,
): RunEmphasis | null {
  if (indexes.length < 2) return null;
  const perWord = indexes.map((index) =>
    resolveWordEmphasisVariant({
      ...shared,
      word: shared.words[index] ?? "",
      index,
      inRun: true,
    }),
  );
  // A syllable the resolver refuses to dress (no letter or number) ends the run's effect.
  if (perWord.some((variant) => variant === null)) return null;

  const agreed = perWord.every((variant) => variant === perWord[0]) ? perWord[0] : undefined;
  const anchored = agreed ?? getRunAnchoredVariant(indexes, shared);
  if (!anchored) return null;
  const style = avoidBlankUnderline(anchored, shared.words);
  return { style, lift: RUN_LEVEL_VARIANTS.includes(style) ? style : null };
}

/**
 * Seed one effect for the whole run from the run itself rather than from a syllable.
 * @param indexes - word indexes of the run, in order
 * @param shared - the page-level inputs, without the per-word fields
 * @returns The variant the run is drawn with
 * @pure true
 */
function getRunAnchoredVariant(
  indexes: readonly number[],
  shared: Omit<WordEmphasisInput, "word" | "index" | "inRun">,
): EmphasisVariant | null {
  const first = indexes[0];
  if (first === undefined) return null;
  const isSecondary =
    shared.secondaryVariant &&
    !shared.emphasized.has(first) &&
    (shared.secondaryEmphasized?.has(first) ?? false);
  // A caller-forced second mark names its own effect; the run simply obeys it.
  if (isSecondary) return shared.secondaryVariant ?? null;
  return getRunEmphasisStyle(shared.text, shared.words, indexes, shared.emphasisColor, shared.pool);
}
