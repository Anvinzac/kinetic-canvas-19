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
 *   data-showcase-intro  which opening variant this take uses (one of `introVariants`)
 *   data-showcase-outro  which end-card variant this take uses (one of `outroVariants`)
 *
 * The sequence is: loading → ready (first frame painted, nothing moving) → intro (badge)
 * → playing (the word, from the first frame of its first page) → outro (end card) → done.
 * A driver waits for `ready`, begins recording, dispatches `start`, and stops on `done`.
 *
 * Exports: SHOWCASE_CONTRACT, ShowcasePhase, ShowcaseIntroVariant, ShowcaseOutroVariant,
 *   pickShowcaseVariants
 * Depends on: none (leaf module)
 */

export const SHOWCASE_CONTRACT = {
  phases: ["loading", "ready", "intro", "playing", "outro", "done", "missing"] as const,
  startEvent: "vocab-showcase-start",
  /** Marks the element a recorder crops to; it is exactly the clip's frame. */
  stageAttribute: "data-showcase-stage",
  /**
   * How the opening badge arrives and leaves. Every variant keeps the same --intro-dur and
   * the same beats (in by ~820ms, out by ~1590ms), so the card handover never moves.
   */
  introVariants: ["pop", "drop", "stamp", "slide", "flip"] as const,
  /** How the end card's address bar looks and arrives; the typing and Enter beats are shared. */
  outroVariants: ["light", "dark", "glass", "rise"] as const,
} as const;

export type ShowcasePhase = (typeof SHOWCASE_CONTRACT.phases)[number];
export type ShowcaseIntroVariant = (typeof SHOWCASE_CONTRACT.introVariants)[number];
export type ShowcaseOutroVariant = (typeof SHOWCASE_CONTRACT.outroVariants)[number];

/**
 * Choose the opening and end-card variants for one take.
 *
 * Unpinned takes differ from each other; a take with a seed gets the same pair every time,
 * so a scheduled job that re-renders a seed reproduces the clip it rendered before. The
 * two picks are decorrelated so a seed does not always pair intro N with outro N.
 * @param seed - the take's seed; random when omitted
 * @param intro - a pinned opening variant
 * @param outro - a pinned end-card variant
 * @returns The pair this take plays
 * @pure true when `seed` is given
 */
export function pickShowcaseVariants(
  seed?: number,
  intro?: ShowcaseIntroVariant,
  outro?: ShowcaseOutroVariant,
): { intro: ShowcaseIntroVariant; outro: ShowcaseOutroVariant } {
  const { introVariants, outroVariants } = SHOWCASE_CONTRACT;
  const base = seed ?? Math.floor(Math.random() * 1_000_000);
  const mixed = Math.imul(base ^ 0x5bd1e995, 0x27d4eb2d) >>> 0;
  return {
    intro: intro ?? introVariants[base % introVariants.length]!,
    outro: outro ?? outroVariants[(mixed >>> 8) % outroVariants.length]!,
  };
}
