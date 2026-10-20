/**
 * What a recorder may rely on when driving /showcase.
 *
 * The sibling of EXPORT_CONTRACT, for the other kind of clip. /export/$code records ONE
 * word stripped to a preset's clear zone; /showcase records a whole promo: an opening
 * badge, the word played in the app's own chrome, and an end card.
 *
 * It exists because the alternative was driving the reader's feed from outside — pausing
 * it by clicking its pause button, replaying a page by synthesising taps on its tap zones,
 * and overriding its layout with an injected stylesheet. Every one of those is a guess
 * about internals that nothing stops changing, and each failed silently at least once:
 * a pause that lost a race the recorder could not see, a tap that moved two pages instead
 * of one, a rule that tied on specificity and lost on source order. Here the sequence is
 * state in a component, so "hold the text" is a prop rather than a race.
 *
 * A leaf module on purpose — same reason as the export contract: a guard has to be able to
 * import this without pulling in the component, which reaches a catalog that only exists
 * inside Vite.
 *
 * On `<body>`:
 *   data-showcase-phase  "loading" | "ready" | "intro" | "playing" | "outro" | "done"
 *                        | "missing"
 *   data-showcase-word   the headword, once resolved
 *
 * The sequence is: loading → ready (first frame painted, nothing moving) → intro (badge)
 * → playing (the word, from the first frame of its first page) → outro (end card) → done.
 * A driver waits for `ready`, begins recording, dispatches `start`, and stops on `done`.
 *
 * Exports: SHOWCASE_CONTRACT, ShowcasePhase
 * Depends on: none (leaf module)
 */

export const SHOWCASE_CONTRACT = {
  phases: ["loading", "ready", "intro", "playing", "outro", "done", "missing"] as const,
  startEvent: "vocab-showcase-start",
  /** Marks the element a recorder crops to; it is exactly the clip's frame. */
  stageAttribute: "data-showcase-stage",
} as const;

export type ShowcasePhase = (typeof SHOWCASE_CONTRACT.phases)[number];
