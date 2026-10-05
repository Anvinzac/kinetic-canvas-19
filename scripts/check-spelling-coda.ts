/**
 * Regression guard for the post-reveal spelling coda.
 *
 * The coda is timed by the playback hook, not by the animation component, so a
 * variant whose stagger or hold drifts silently changes how long every card
 * lingers. These assertions pin the variant catalogue, the determinism of the
 * per-card pick, and the total phase budget across the real catalog.
 *
 * Usage: npx tsx scripts/check-spelling-coda.ts
 * Depends on: ../src/features/vocabulary/lib/spelling, ../src/features/vocabulary/data/catalog.json
 */

import { readFileSync } from "node:fs";
import rawCatalog from "../src/features/vocabulary/data/catalog.json";
import {
  SPELLING_FIT_GUARD,
  SPELLING_HOLD_SECONDS,
  SPELLING_NOMINAL_FONT_SIZE,
  SPELLING_STAGGER,
  SPELLING_VARIANTS,
  getSpellingDurationMs,
  getSpellingFitFontSize,
  pickSpellingVariant,
  type SpellingVariant,
} from "../src/features/vocabulary/lib/spelling";

let failures = 0;

function check(condition: boolean, message: string): void {
  if (condition) {
    console.log(`OK — ${message}`);
    return;
  }
  failures += 1;
  console.error(`FAIL — ${message}`);
}

// ── 1. Variant catalogue ─────────────────────────────────────────────────────

check(
  SPELLING_VARIANTS.length === 8,
  `exactly eight spelling variants (got ${SPELLING_VARIANTS.length})`,
);
check(new Set(SPELLING_VARIANTS).size === SPELLING_VARIANTS.length, "every variant id is distinct");
check(
  SPELLING_VARIANTS.every((variant) => SPELLING_STAGGER[variant] > 0),
  "every variant declares a positive stagger",
);
check(
  Object.keys(SPELLING_STAGGER).every((key) =>
    (SPELLING_VARIANTS as readonly string[]).includes(key),
  ),
  "stagger table has no orphan variants",
);

// ── 2. Deterministic per-card pick ──────────────────────────────────────────

const seeds = Array.from({ length: 400 }, (_, index) => `rev:seed:topic::${index}`);
const picked = seeds.map((seed) => pickSpellingVariant(seed));

check(
  picked.every((variant, index) => variant === pickSpellingVariant(seeds[index]!)),
  "the same seed always picks the same variant (stable across re-renders)",
);
check(
  picked.every((variant) => (SPELLING_VARIANTS as readonly string[]).includes(variant)),
  "every pick is a declared variant",
);

const seen = new Set<SpellingVariant>(picked);
check(
  seen.size === SPELLING_VARIANTS.length,
  `400 consecutive stream positions exercise all eight variants (got ${seen.size})`,
);

// Adjacent cards should rarely repeat, otherwise the coda feels stuck.
let adjacentRepeats = 0;
for (let index = 1; index < picked.length; index += 1) {
  if (picked[index] === picked[index - 1]) adjacentRepeats += 1;
}
check(
  adjacentRepeats / picked.length < 0.25,
  `adjacent cards usually differ (repeat rate ${(adjacentRepeats / picked.length).toFixed(2)})`,
);

// ── 3. Phase budget ─────────────────────────────────────────────────────────

const catalog = rawCatalog as { words: Array<{ id: string; word: string }> };
check(catalog.words.length > 0, `catalog holds words to test (${catalog.words.length})`);

/** A card must not stall the stream: the coda stays inside a twelve-second budget. */
const BUDGET_MS = 12000;
/** Reduced motion is a static word plus a reading beat, never an animation run. */
const REDUCED_BUDGET_MS = 4000;

let longest = { word: "", variant: "" as string, ms: 0 };
const overBudget: string[] = [];
for (const entry of catalog.words) {
  for (const variant of SPELLING_VARIANTS) {
    const ms = getSpellingDurationMs(entry.word, variant, false);
    if (ms > longest.ms) longest = { word: entry.word, variant, ms };
    if (ms > BUDGET_MS) overBudget.push(`${entry.word}/${variant}=${ms}`);
  }
}

check(
  overBudget.length === 0,
  `every word+variant fits the ${BUDGET_MS}ms budget (${overBudget.slice(0, 4).join(", ") || "none over"})`,
);
check(
  longest.ms > SPELLING_HOLD_SECONDS * 1000,
  `longest phase (${longest.word}/${longest.variant}=${longest.ms}ms) outlasts the hold`,
);

const reducedOver = catalog.words.filter(
  (entry) =>
    getSpellingDurationMs(entry.word, pickSpellingVariant(entry.id), true) > REDUCED_BUDGET_MS,
);
check(
  reducedOver.length === 0,
  `reduced motion stays under ${REDUCED_BUDGET_MS}ms for every word (${reducedOver.length} over)`,
);
check(
  catalog.words.every(
    (entry) =>
      getSpellingDurationMs(entry.word, pickSpellingVariant(entry.id), true) ===
      getSpellingDurationMs(entry.word, "bounce", true),
  ),
  "reduced-motion duration is variant-independent (no motion, no per-variant timing)",
);

// ── 4. Letter counting must survive non-ASCII answers ───────────────────────

// Array.from (not .length) keeps combining marks and surrogate pairs whole, so
// an accented answer is timed by its visible letters rather than its code units.
check(
  getSpellingDurationMs("resumé", "wave", false) === getSpellingDurationMs("resume", "wave", false),
  "an accented answer times identically to its ASCII form (6 letters each)",
);
const surrogate = "a\uD83D\uDE00b"; // a + emoji + b
const surrogateMs = getSpellingDurationMs(surrogate, "wave", false);
const threeLetters = getSpellingDurationMs("abc", "wave", false);
check(
  surrogateMs === threeLetters,
  `surrogate pairs count as one letter (emoji word ${surrogateMs}ms vs abc ${threeLetters}ms)`,
);

// ── 5. Every answer must fit on ONE line ─────────────────────────────────

// The letter row is nowrap, so its font size is the only thing that can absorb a
// long answer. Natural width is modelled from the live measurement (a 10-letter
// answer measured 604px at the nominal 96px, i.e. ~0.63em per letter), then the
// solved size is applied back to see whether the row still fits the card.
const PER_LETTER_EM = 0.63;
const CARD_WIDTHS = [631, 430, 390, 360, 320, 240, 180];
const overWide: string[] = [];
for (const entry of catalog.words) {
  const letters = Array.from(entry.word).length;
  for (const cardWidth of CARD_WIDTHS) {
    const available = cardWidth * SPELLING_FIT_GUARD;
    const natural = letters * PER_LETTER_EM * SPELLING_NOMINAL_FONT_SIZE;
    const size = getSpellingFitFontSize(natural, available);
    const rendered = (natural * size) / SPELLING_NOMINAL_FONT_SIZE;
    if (rendered > available + 0.01) {
      overWide.push(`${entry.word}@${cardWidth}px (${rendered.toFixed(1)} > ${available})`);
    }
  }
}
check(
  overWide.length === 0,
  `every catalog word at every card width fits one row (${overWide.length} over: ${overWide
    .slice(0, 3)
    .join(", ")})`,
);

// The mechanism only works if nothing lifts the result off the floor it replaced.
const compromiseNatural = 10 * PER_LETTER_EM * SPELLING_NOMINAL_FONT_SIZE;
const cramped = getSpellingFitFontSize(compromiseNatural, 120 * SPELLING_FIT_GUARD);
check(
  cramped < 18,
  `a ten-letter answer on a 120px card shrinks past the old 18px floor (got ${cramped.toFixed(1)}px)`,
);
check(
  getSpellingFitFontSize(
    6 * PER_LETTER_EM * SPELLING_NOMINAL_FONT_SIZE,
    631 * SPELLING_FIT_GUARD,
  ) === SPELLING_NOMINAL_FONT_SIZE,
  "short answers keep the full hero size (fit only ever shrinks)",
);
check(
  getSpellingFitFontSize(0, 500) === SPELLING_NOMINAL_FONT_SIZE &&
    getSpellingFitFontSize(600, 0) === SPELLING_NOMINAL_FONT_SIZE &&
    Number.isFinite(getSpellingFitFontSize(600, Number.NaN)),
  "a failed measurement falls back to the nominal size instead of collapsing to 0",
);

// ...and the other half of the guarantee is the CSS that forbids the wrap.
const spellingCss = readFileSync(
  new URL("../src/features/vocabulary/vocabulary.css", import.meta.url),
  "utf8",
);
const wordRule = spellingCss.match(/\.vocab-spelling-word\s*\{([^}]*)\}/)?.[1] ?? "";
check(
  /flex-wrap:\s*nowrap/.test(wordRule),
  ".vocab-spelling-word is declared nowrap (the row cannot break onto a second line)",
);

if (failures > 0) {
  console.error(`\n${failures} spelling-coda check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log("\nAll spelling-coda bounds hold.");
}
