/**
 * Guard: a word only rests under a filter if its entrance actually used one.
 *
 * `filter: blur(0px)` looks like a no-op and is not. A filter establishes a filter region
 * clipped to the element's border box, so anything a descendant paints OUTSIDE that box is
 * cut off — the emphasis underline's glow, a word's own text-shadow. The visible result is
 * a soft shadow rendering as a hard rectangle and then disappearing.
 *
 * Resting every entrance on `blur(0px)` therefore put five of the eight styles, including
 * the default, under a filter they never needed. This asserts the rule that replaced it,
 * and the non-vacuous half matters just as much: an entrance that DOES blur still has to
 * rest on blur(0px), because `none` is not interpolable and animating toward it snaps.
 *
 * Run: npx tsx scripts/check-entrance-rest.ts
 */
import assert from "node:assert/strict";
import {
  ENTRANCE_REST,
  getEntranceHidden,
  getEntranceRest,
} from "../src/features/post-player/lib/entrances";

const checks: string[] = [];
function check(label: string, passed: boolean, detail?: unknown) {
  checks.push(`${passed ? "OK  " : "FAIL"}  ${label}`);
  if (!passed) {
    process.exitCode = 1;
    if (detail !== undefined) console.error("      ", detail);
  }
}

// Every entrance style the resolver can produce.
const STYLES = [
  "poetic-bloom",
  "poetic-drift",
  "fall",
  "pop",
  "drift",
  "tilt",
  "focus",
  "rise",
] as const;

check("the shared rest state carries no filter of its own", ENTRANCE_REST.filter === undefined, {
  filter: ENTRANCE_REST.filter,
});

let blurring = 0;
let crisp = 0;
for (const style of STYLES) {
  for (const important of [true, false]) {
    for (const index of [0, 1]) {
      const hidden = getEntranceHidden(style, important, index);
      const rest = getEntranceRest(hidden);
      const hiddenBlurs = hidden.filter !== undefined;
      if (hiddenBlurs) blurring += 1;
      else crisp += 1;
      check(
        `${style}${important ? " (emphasised)" : ""} rests ${hiddenBlurs ? "on blur(0px)" : "with no filter"}`,
        hiddenBlurs ? rest.filter === "blur(0px)" : rest.filter === undefined,
        { hidden: hidden.filter, rest: rest.filter },
      );
      // The rest state must still reset every transform, whatever it does about filter.
      for (const key of ["opacity", "x", "y", "scale", "rotate"] as const) {
        assert.notEqual(rest[key], undefined, `${style} rest is missing ${key}`);
      }
    }
  }
}

// Both halves have to be exercised or the rule is only half asserted.
check(`some entrances blur (${blurring} cases)`, blurring > 0);
check(`most do not (${crisp} cases)`, crisp > blurring);

console.log(checks.join("\n"));
if (process.exitCode) console.error("\nentrance rest guard FAILED");
else console.log(`\n${checks.length} entrance-rest assertions passed`);
