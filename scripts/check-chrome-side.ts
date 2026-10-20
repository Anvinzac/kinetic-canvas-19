/**
 * Guards the horizontal chrome inset.
 *
 * --vocab-chrome-side moves everything anchored to a left or right edge inward, so a
 * platform that crops the sides of a clip does not take the title, the progress row or the
 * buttons with it. The failure it exists to prevent is partial application: one edge-
 * anchored thing left behind reads as a layout bug rather than as a missing variable, and
 * the recording is the place nobody looks until it is already posted.
 *
 * Two assertions, both on the RESULT rather than on the decision:
 *
 *   1. Every known edge-anchored rule reads the variable.
 *   2. Nothing DECLARES it anywhere in the stylesheet. It is set on :root by the recorder
 *      and inherited; a declaration on a descendant would beat that inherited value and
 *      silently pin the element back to the edge. That exact trap has already cost this
 *      file two debugging sessions (--vocab-corner, then --vocab-chrome-inset), which is
 *      why it is asserted rather than remembered.
 *
 * Run: npx tsx scripts/check-chrome-side.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CSS = join(import.meta.dirname, "..", "src/features/vocabulary/vocabulary.css");
const VAR = "--vocab-chrome-side";

/** Every rule that puts something against a horizontal edge of the recorded feed. */
const MUST_READ: { selector: string; why: string }[] = [
  { selector: ".vocab-toolbar", why: "the title and the settings gear" },
  { selector: ".vocab-toolbar::before", why: "the toolbar's scrim, which must still reach the edges" },
  { selector: ".vocab-stage-band", why: "the box the text is fitted to" },
  { selector: ".vocab-progress", why: "the page progress row" },
  { selector: ".vocab-action-bar", why: "the button row underneath" },
  { selector: ".vocab-saved-dock", why: "the saved-words rail on the right edge" },
];

const css = readFileSync(CSS, "utf8");
const failures: string[] = [];
let checks = 0;

/**
 * Every rule body written for a selector, not just the first.
 *
 * A selector is routinely split across rules here — one shared with a sibling for the
 * common declarations, another on its own for what differs. Reading only the first match
 * asks the wrong question ("does THIS rule set it?") instead of the one that matters
 * ("is it set for this element at all?").
 *
 * @param selector - the selector as written in the stylesheet
 * @returns the declarations of every rule naming it; empty when the selector is absent
 */
function ruleBodies(selector: string): string[] {
  // Anchored to a line start so `.vocab-progress` cannot match `.vocab-progress span`,
  // and so a selector appearing inside a longer compound one is not mistaken for it.
  const pattern = new RegExp(
    `^\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(,|\\{)`,
    "gm",
  );
  const bodies: string[] = [];
  for (const match of css.matchAll(pattern)) {
    const open = css.indexOf("{", match.index);
    if (open === -1) continue;
    const close = css.indexOf("}", open);
    if (close === -1) continue;
    bodies.push(css.slice(open + 1, close));
  }
  return bodies;
}

for (const { selector, why } of MUST_READ) {
  checks += 1;
  const bodies = ruleBodies(selector);
  if (bodies.length === 0) {
    failures.push(`${selector} is gone from the stylesheet — ${why} is no longer guarded`);
    continue;
  }
  if (!bodies.some((body) => body.includes(VAR))) {
    failures.push(`${selector} does not read ${VAR}; ${why} would stay at the edge and be cropped`);
  }
}

// A declaration, not a read: `--vocab-chrome-side:` with a value, rather than var(--…).
checks += 1;
const declarations = [...css.matchAll(new RegExp(`${VAR}\\s*:`, "g"))].filter((m) => {
  // `var(--vocab-chrome-side, 0px)` contains no colon after the name, so any colon match
  // that is not preceded by `var(` is a real declaration.
  const before = css.slice(Math.max(0, m.index - 4), m.index);
  return !before.endsWith("var(");
});
if (declarations.length) {
  failures.push(
    `${VAR} is DECLARED ${declarations.length}x in the stylesheet. It must only ever be read ` +
      `as var(${VAR}, 0px): a declaration on any element beats the value inherited from :root, ` +
      `so the recorder's inset would silently stop reaching that element.`,
  );
}

// Every read must carry the 0px fallback, or the reader-facing layout shifts the moment
// the variable is absent — which is every visit that is not a recording.
checks += 1;
const reads = [...css.matchAll(new RegExp(`var\\(${VAR}([^)]*)\\)`, "g"))];
const bare = reads.filter((m) => !m[1]!.includes(","));
if (bare.length) {
  failures.push(`${bare.length} read(s) of ${VAR} have no fallback; use var(${VAR}, 0px)`);
}
if (reads.length === 0) failures.push(`${VAR} is never read — the inset does nothing`);

for (const line of failures) console.log(`FAIL  ${line}`);
if (!failures.length) {
  for (const { selector, why } of MUST_READ) console.log(`OK    ${selector} — ${why}`);
  console.log(`OK    ${VAR} is read ${reads.length}x, always with a fallback, declared nowhere`);
}

console.log(
  failures.length
    ? `\n${failures.length} of ${checks} chrome-side checks failed`
    : `\n${checks} chrome-side checks passed`,
);
process.exitCode = failures.length ? 1 : 0;
