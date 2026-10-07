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
 * Exports: resolveWordEmphasisVariant, getRunEmphasis, RUN_LEVEL_VARIANTS
 * Depends on: kinetic-text emphasis + bound-phrase helpers
 */

import {
  getBoundPhraseEmphasisSeed,
  getBoundPhraseStartIndex,
  getEmphasisVariant,
  getRunEmphasisStyle,
  isDimEmphasisColor,
  type EmphasisVariant,
} from "@/features/kinetic-text";

/**
 * Effects that are drawn once across a whole run instead of once per syllable.
 * `underline` is absent because joined syllables already draw one continuous bar,
 * `frame` because a grouped frame is shown as that underline, and `color` because
 * it does not move.
 */
export const RUN_LEVEL_VARIANTS: readonly EmphasisVariant[] = [
  "sweep",
  "halo",
  "glow",
  "pulse",
  "jiggle",
];

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
  const variant =
    secondary && secondaryVariant
      ? secondaryVariant
      : getEmphasisVariant(
          input.text,
          getBoundPhraseEmphasisSeed(words, index, phraseKeys),
          getBoundPhraseStartIndex(words, index, phraseKeys),
          !isDimEmphasisColor(input.emphasisColor),
        );
  const boxed = variant === "frame" && !input.inRun && input.allowFrame !== false;
  return variant === "frame" && !boxed ? "underline" : variant;
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
  const style = agreed ?? getRunAnchoredVariant(indexes, shared);
  if (!style) return null;
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
  return getRunEmphasisStyle(shared.text, shared.words, indexes, shared.emphasisColor);
}
