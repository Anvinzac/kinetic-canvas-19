/**
 * Preview tempo config, entrance variants, and rhythm delays for KineticText.
 *
 * Exports: tempoConfig, entranceVariants, getRhythmDelay
 * Depends on: features/canvas Tempo, Rhythm, CanvasSpec
 */

import type { CanvasSpec, Rhythm, Tempo } from "@/features/canvas";

// Preview tempo shape — diverges from PostCard's tempoConfig (which adds
// pageMultiplier / wordDuration and uses different wordDelay values).
// loopSeconds match TEMPO_LOOP_SECONDS in ../lib/loop (used by getLoopAnimation).
export const tempoConfig: Record<
  Tempo,
  { duration: number; wordDelay: number; loopSeconds: number }
> = {
  slow: { duration: 1.05, wordDelay: 0.2, loopSeconds: 3.4 },
  steady: { duration: 0.8, wordDelay: 0.14, loopSeconds: 2.4 },
  snappy: { duration: 0.48, wordDelay: 0.08, loopSeconds: 1.45 },
};

// Preview-only entrance variants keyed by CanvasSpec.entrance.
// PostCard uses a separate ENTRANCE_STYLES personality system — do not unify.
/**
 * entranceVariants helper
 * @param entrance - entrance argument
 * @param rhythm? - rhythm? argument
 * @returns Function result
 */
export function entranceVariants(entrance: CanvasSpec["entrance"], rhythm?: Rhythm): {
  initial: Record<string, number | string>;
  animate: Record<string, number | string>;
} {
  if (rhythm === "poetic") {
    return {
      initial: { opacity: 0, y: 12, scale: 1.05, filter: "blur(18px)" },
      animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
    };
  }

  switch (entrance) {
    case "fade":
      return { initial: { opacity: 0 }, animate: { opacity: 1 } };
    case "slide":
      return { initial: { opacity: 0, y: 40 }, animate: { opacity: 1, y: 0 } };
    case "scale":
      return { initial: { opacity: 0, scale: 0.3 }, animate: { opacity: 1, scale: 1 } };
    case "blur":
      return {
        initial: { opacity: 0, filter: "blur(24px)" },
        animate: { opacity: 1, filter: "blur(0px)" },
      };
    case "split":
      return { initial: { opacity: 0, y: 40 }, animate: { opacity: 1, y: 0 } };
  }
}

// Preview rhythm delays — multipliers differ from PostCard getWordDelay (smooth/burst).
/**
 * Compute rhythmdelay.
 * @param index - index argument
 * @param tempo - tempo argument
 * @param rhythm - rhythm argument
 * @returns Computed value
 */
export function getRhythmDelay(index: number, tempo: Tempo, rhythm: Rhythm): number {
  const base = tempoConfig[tempo].wordDelay;
  if (rhythm === "poetic") return index * base * 1.45;
  if (rhythm === "smooth") return index * base * 0.8;
  if (rhythm === "burst") return index * base * 0.7;
  return index * base;
}
