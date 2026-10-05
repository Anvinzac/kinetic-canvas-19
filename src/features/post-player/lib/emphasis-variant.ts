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
 * Exports: resolveWordEmphasisVariant, getRunEmphasisVariant, RUN_LEVEL_VARIANTS
 * Depends on: kinetic-text emphasis + bound-phrase helpers
 */

import {
  getBoundPhraseEmphasisSeed,
  getBoundPhraseStartIndex,
  getEmphasisVariant,
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
  return input.inRun && variant === "frame" ? "underline" : variant;
}

/**
 * The effect a run of consecutive emphasised words should carry as one, if any.
 * Only when every word in the run resolved to the same moving effect — a run whose
 * words disagree keeps its per-word drawing.
 * @param indexes - word indexes of the run, in order
 * @param shared - the page-level inputs, without the per-word fields
 * @returns The shared run-level variant, or null to draw each word on its own
 * @pure true
 */
export function getRunEmphasisVariant(
  indexes: readonly number[],
  shared: Omit<WordEmphasisInput, "word" | "index" | "inRun">,
): EmphasisVariant | null {
  if (indexes.length < 2) return null;
  let common: EmphasisVariant | null = null;
  for (const index of indexes) {
    const variant = resolveWordEmphasisVariant({
      ...shared,
      word: shared.words[index] ?? "",
      index,
      inRun: true,
    });
    if (!variant) return null;
    if (common && variant !== common) return null;
    common = variant;
  }
  return common && RUN_LEVEL_VARIANTS.includes(common) ? common : null;
}
