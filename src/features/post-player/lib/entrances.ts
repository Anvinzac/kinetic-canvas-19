/**
 * Auto-picked word entrance personalities for the feed player.
 *
 * Exports: ENTRANCE_REST, getEntranceStyle, getEntranceHidden, getEntranceTransition
 * Depends on: framer-motion TargetAndTransition/Transition, canvas Rhythm, kinetic-text getStableNumber
 */

import type { TargetAndTransition, Transition } from "framer-motion";
import type { Rhythm } from "@/features/canvas";
import { getStableNumber } from "@/features/kinetic-text";

// Every post is auto-assigned one of these word-entrance "personalities", picked
// stably from its text so replays look identical and the creator never has to
// choose. Only the starting (`hidden`) state and the transition curve differ —
// all of them settle to the exact same neutral resting state, so layout, fit and
// emphasis sizing are unaffected no matter which entrance plays.
const ENTRANCE_STYLES = ["rise", "fall", "pop", "drift", "tilt", "focus"] as const;
const POETIC_ENTRANCE_STYLES = ["poetic-bloom", "poetic-drift"] as const;
type EntranceStyle = (typeof ENTRANCE_STYLES)[number];
type PoeticEntranceStyle = (typeof POETIC_ENTRANCE_STYLES)[number];
export type ResolvedEntranceStyle = EntranceStyle | PoeticEntranceStyle;

// Shared resting state — resets every transform any hidden state touches (x, y,
// scale, rotate, blur) so words always land in the same place.
export const ENTRANCE_REST: TargetAndTransition = {
  opacity: 1,
  x: 0,
  y: 0,
  scale: 1,
  rotate: 0,
  filter: "blur(0px)",
};

/**
 * Compute entrancestyle.
 * @param seed - seed argument
 * @param rhythm? - rhythm? argument
 * @returns Computed value
 */
export function getEntranceStyle(seed: string, rhythm?: Rhythm): ResolvedEntranceStyle {
  if (rhythm === "poetic") {
    return POETIC_ENTRANCE_STYLES[
      getStableNumber(`poetic-entrance|${seed}`) % POETIC_ENTRANCE_STYLES.length
    ];
  }
  return ENTRANCE_STYLES[getStableNumber(`entrance|${seed}`) % ENTRANCE_STYLES.length];
}

/**
 * Compute entrancehidden.
 * @param style - style argument
 * @param important - important argument
 * @param index - index argument
 * @returns Computed value
 */
export function getEntranceHidden(
  style: ResolvedEntranceStyle,
  important: boolean,
  index: number,
): TargetAndTransition {
  const dir = index % 2 === 0 ? -1 : 1;
  switch (style) {
    case "poetic-bloom":
      // A slow focus-and-breath reveal: no spring, no punch, just a soft bloom.
      return {
        opacity: 0,
        y: important ? 14 : 10,
        scale: important ? 1.12 : 1.06,
        filter: "blur(18px)",
      };
    case "poetic-drift":
      // A barely-there lateral drift, like a line settling on paper.
      return {
        opacity: 0,
        x: dir * (important ? 16 : 10),
        y: important ? 12 : 8,
        scale: important ? 1.08 : 1.03,
        filter: "blur(16px)",
      };
    case "fall":
      // Drop down from above and settle.
      return {
        opacity: 0,
        y: important ? -38 : -26,
        scale: important ? 0.72 : 0.9,
        filter: "blur(8px)",
      };
    case "pop":
      // Punch up from tiny with a spring overshoot.
      return { opacity: 0, scale: important ? 0.24 : 0.42, filter: "blur(4px)" };
    case "drift":
      // Fan in from alternating sides.
      return { opacity: 0, x: dir * (important ? 54 : 40), y: 6, filter: "blur(8px)" };
    case "tilt":
      // Swing into place with a small rotation.
      return {
        opacity: 0,
        y: important ? 22 : 15,
        rotate: dir * 9,
        scale: important ? 0.74 : 0.9,
        filter: "blur(7px)",
      };
    case "focus":
      // Cinematic rack-focus: bloom in from slightly oversized + heavy blur.
      return { opacity: 0, scale: important ? 1.5 : 1.2, filter: "blur(16px)" };
    case "rise":
    default:
      // The original: float up from below with a soft blur.
      return {
        opacity: 0,
        y: important ? 34 : 22,
        scale: important ? 0.66 : 0.88,
        filter: "blur(10px)",
      };
  }
}

/**
 * Compute entrancetransition.
 * @param style - style argument
 * @param delay - delay argument
 * @param duration - duration argument
 * @returns Computed value
 */
export function getEntranceTransition(
  style: ResolvedEntranceStyle,
  delay: number,
  duration: number,
): Transition {
  if (style === "poetic-bloom" || style === "poetic-drift") {
    return { delay, duration: duration * 1.55, ease: [0.16, 1, 0.3, 1] };
  }
  if (style === "pop") {
    return { delay, type: "spring", stiffness: 380, damping: 17, mass: 0.7 };
  }
  if (style === "tilt") {
    return { delay, type: "spring", stiffness: 300, damping: 19, mass: 0.8 };
  }
  // Slower, softer easing for the blur-heavy reveals so they breathe rather than snap.
  const stretch = style === "focus" ? 1.12 : style === "drift" ? 1.05 : 1;
  return { delay, duration: duration * stretch, ease: [0.22, 1, 0.36, 1] };
}

