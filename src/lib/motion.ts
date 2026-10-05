/**
 * Shared motion vocabulary: three springs, two curves and one beat.
 *
 * Every surface used to pick its own stiffness/damping or `0.15s ease`, so no two
 * things moved alike. These are the only values new motion should reach for; the
 * CSS twins live in styles.css (`--ease-out`, `--ease-spring`, `--dur-*`).
 *
 * Exports: SPRING, EASE, getBeatSeconds
 * Depends on: framer-motion Transition type, canvas Tempo
 */

import type { Transition } from "framer-motion";
import type { Tempo } from "@/features/canvas";

export const SPRING = {
  /** Direct response to a touch: fast, no overshoot. */
  snappy: { type: "spring", stiffness: 520, damping: 34, mass: 0.8 },
  /** Celebration and arrival: one clear overshoot, then rest. */
  bouncy: { type: "spring", stiffness: 420, damping: 15, mass: 0.8 },
  /** Large surfaces (sheets, panels, whole pages): weighty, barely overshoots. */
  gentle: { type: "spring", stiffness: 240, damping: 26, mass: 1 },
} as const satisfies Record<string, Transition>;

export const EASE = {
  /** Decelerate into place — entrances. */
  out: [0.22, 1, 0.36, 1],
  /** Accelerate away — exits, which should be shorter than entrances. */
  in: [0.5, 0, 0.75, 0],
} as const;

/**
 * One beat for a tempo, in seconds. Emphasis loops, ambient drift and reveal
 * accents are all whole multiples of this, so a page moves to a single pulse
 * instead of several unrelated periods. A quarter of the tempo's idle-loop length,
 * which is what the loop durations were already implying (100 bpm at "steady").
 * @pure true
 */
export function getBeatSeconds(tempo: Tempo): number {
  return BEAT_SECONDS[tempo];
}

const BEAT_SECONDS: Record<Tempo, number> = {
  slow: 0.85,
  steady: 0.6,
  snappy: 0.36,
};
