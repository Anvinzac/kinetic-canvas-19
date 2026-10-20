/**
 * Guards the showcase's published surface.
 *
 * SHOWCASE_CONTRACT is what a recorder waits on. Renaming a phase or the start event
 * breaks whatever is recording, at whatever hour it runs, with nobody watching — and it
 * breaks as a TIMEOUT rather than an error, because a driver polling for a phase that no
 * longer exists simply waits. This makes that break immediate instead.
 *
 * Run: npx tsx scripts/check-showcase.ts
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { SHOWCASE_CONTRACT } from "../src/features/vocabulary/lib/showcase-contract";

const root = join(import.meta.dirname, "..");
const recorder = readFileSync(join(root, "scripts/render-export-clip.ts"), "utf8");
const page = readFileSync(
  join(root, "src/features/vocabulary/components/ShowcasePage.tsx"),
  "utf8",
);
const route = readFileSync(join(root, "src/routes/showcase.tsx"), "utf8");

let checks = 0;
function ok(label: string, condition: boolean) {
  checks += 1;
  assert.ok(condition, label);
  console.log(`OK    ${label}`);
}

// ── The phases the recorder actually polls for ──────────────────────────────────────────
// The driver waits for "ready", then stops on "done". Both must exist, and the page must
// be able to reach them.
for (const phase of ["loading", "ready", "intro", "playing", "outro", "done", "missing"]) {
  ok(
    `the contract declares the "${phase}" phase`,
    (SHOWCASE_CONTRACT.phases as readonly string[]).includes(phase),
  );
}
ok("the page can set every declared phase", SHOWCASE_CONTRACT.phases.every((p) => page.includes(`"${p}"`)));

// ── The attribute the recorder reads ────────────────────────────────────────────────────
// dataset.showcasePhase is `data-showcase-phase` in the DOM; the recorder reads the
// dataset form, the page writes it, and a guard that only checked one would miss a rename
// of the other.
ok("the recorder polls data-showcase-phase", recorder.includes("dataset.showcasePhase"));
ok("the page writes data-showcase-phase", page.includes("dataset.showcasePhase"));
ok("the recorder reads the headword", recorder.includes("dataset.showcaseWord"));
ok("the page writes the headword", page.includes("dataset.showcaseWord"));

// ── The cue ─────────────────────────────────────────────────────────────────────────────
ok(
  "the recorder dispatches the contract's own start event",
  recorder.includes("SHOWCASE_CONTRACT.startEvent"),
);
ok("the page listens for it", page.includes("SHOWCASE_CONTRACT.startEvent"));

// ── The thing the whole surface exists for ──────────────────────────────────────────────
// The card must be held until the badge has gone. This is the one behaviour that cannot be
// checked by rendering, because its failure looks like success: a clip that opens on text
// which is already there reads as "the animation played", not as "the animation was missed".
ok(
  "the card is held until the intro is over",
  /active=\{phase === "playing"\}/.test(page),
);
ok(
  "and held as PAUSED rather than abandoned, so it resumes where it was",
  /\n\s+current\n/.test(page),
);

// ── Not for readers ─────────────────────────────────────────────────────────────────────
ok("the route is noindex", route.includes("noindex"));

console.log(`\n${checks} showcase checks passed`);
