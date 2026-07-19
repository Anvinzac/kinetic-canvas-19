import type { Loop, Tempo } from "@/features/canvas";

/**
 * Shared idle-loop durations. Identical to `tempoConfig[*].loopSeconds` in both
 * KineticText and PostCard (those configs otherwise diverge — do not unify).
 */
export const TEMPO_LOOP_SECONDS: Record<Tempo, number> = {
  slow: 3.4,
  steady: 2.4,
  snappy: 1.45,
};

/**
 * @responsibility Build the CSS `animation` value for the canvas idle loop.
 * @inputs Loop kind + tempo bucket
 * @outputs CSS animation shorthand, or undefined when loop is "none"
 * @pure true
 */
export function getLoopAnimation(loop: Loop, tempo: Tempo) {
  if (loop === "none") return undefined;
  return `kinetic-${loop} ${TEMPO_LOOP_SECONDS[tempo]}s ease-in-out infinite`;
}
