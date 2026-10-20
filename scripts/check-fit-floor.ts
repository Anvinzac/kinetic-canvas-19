/**
 * Guards the rule that a legibility floor never pushes text outside its box.
 *
 * getPreviewFitFloor stops a short page being shrunk into nothing: a one-word page floors
 * at 0.74. That is a preference. Fitting inside the width is not — above it the text is
 * simply drawn past the edges, which is the one outcome worse than being set small.
 *
 * The bug this was written for: the answer word is a one-word page, so it floored at 0.74,
 * and the moment the text band was narrowed to clear a platform's side crop the long words
 * stopped fitting and hung out over both edges. It was invisible until the band moved,
 * because at full width 0.74 happened to be enough.
 *
 * Asserted here rather than in the browser because the case that matters is a long word on
 * a narrow band, and waiting for the feed to serve one is luck. The clamp is pure, so it
 * can simply be asked.
 *
 * Run: npx tsx scripts/check-fit-floor.ts
 */
import assert from "node:assert";

import { clampFitScale, getPreviewFitFloor } from "../src/features/kinetic-text/components/preview-fit";

let checks = 0;
function ok(label: string, condition: boolean) {
  checks += 1;
  assert.ok(condition, label);
  console.log(`OK    ${label}`);
}

// ── The floor is still what it was ──────────────────────────────────────────────────────
const soloFloor = getPreviewFitFloor("support");
ok("a one-word page still floors at 0.74", Math.abs(soloFloor - 0.74) < 1e-9);
ok(
  "a long page floors lower than a short one",
  getPreviewFitFloor(new Array(20).fill("word").join(" ")) < soloFloor,
);

// ── The box wins when the two disagree ──────────────────────────────────────────────────
// "disappointed" measured 379px at 64px in the reveal face; the band at --side 31 is 343px.
// Width alone therefore allows 343/379 ≈ 0.905 of whatever the fit already was. Drive the
// case that bit: the floor sits ABOVE what the width permits.
const widthLimit = 0.52;
ok(
  "a floor above the width limit does not win",
  clampFitScale(0.3, soloFloor, widthLimit) <= widthLimit + 1e-9,
);
ok(
  "and the result is exactly the width limit, not the floor",
  Math.abs(clampFitScale(0.3, soloFloor, widthLimit) - widthLimit) < 1e-9,
);

// ── Everywhere else nothing moves ───────────────────────────────────────────────────────
// The regression risk is the opposite one: clamping to width in cases the floor used to
// win would shrink pages that were never too wide.
ok(
  "a floor below the width limit still raises a too-small fit",
  Math.abs(clampFitScale(0.3, soloFloor, 1) - soloFloor) < 1e-9,
);
ok(
  "a fit already above the floor is left alone",
  Math.abs(clampFitScale(0.9, soloFloor, 1) - 0.9) < 1e-9,
);
ok("the result never exceeds the width limit", clampFitScale(1, 1, 0.8) <= 0.8 + 1e-9);

// A sweep, because the three cases above are the ones I thought of.
let violations = 0;
for (let fit = 0; fit <= 1.0001; fit += 0.05) {
  for (let floor = 0; floor <= 1.0001; floor += 0.05) {
    for (let limit = 0.05; limit <= 1.0001; limit += 0.05) {
      const got = clampFitScale(fit, floor, limit);
      // The one invariant that matters: never wider than the box allows.
      if (got > limit + 1e-9) violations += 1;
      // And never smaller than it needs to be — the floor still applies under the limit.
      const want = Math.min(Math.max(floor, fit), limit);
      if (Math.abs(got - want) > 1e-9) violations += 1;
    }
  }
}
ok(`no violations across ${21 * 21 * 20} combinations`, violations === 0);

console.log(`\n${checks} fit-floor checks passed`);
