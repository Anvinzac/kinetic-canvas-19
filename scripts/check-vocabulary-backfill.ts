/**
 * Sanity check: the vocabulary stream must stop paging once the server can no
 * longer offer an unseen word, so a fully blocked day-history cannot re-arm the
 * backfill effect on every response. Run: npx tsx scripts/check-vocabulary-backfill.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  canWalkFurther,
  getWalkedPositions,
  VOCAB_MAX_PAGES,
  VOCAB_PAGE_LIMIT,
} from "../src/features/vocabulary/lib/backfill";
import { isWordAllowed, type ViewHistory } from "../src/features/vocabulary/lib/history";
import type { FeedEntry } from "../src/features/vocabulary/types";

const NOW = 1_800_000_000_000;
const VISIBLE_TARGET = 6;

/** Deterministic stand-in for readVocabularyPage: positions cycle a pool forever. */
function makePage(
  pool: string[],
  position: number,
  streamKey = "rev:seed:topic:level",
): FeedEntry[] {
  return Array.from({ length: VOCAB_PAGE_LIMIT }, (_, offset) => {
    const absolute = position + offset;
    return {
      occurrenceId: `${streamKey}:${absolute}`,
      position: absolute,
      cycle: Math.floor(absolute / pool.length),
      word: { id: pool[absolute % pool.length] } as FeedEntry["word"],
    };
  });
}

/**
 * Replay the stream's forward-paging decisions. `blocked` mimics the day-history
 * filter in VocabularyStream: a blocked entry is only kept if it was already
 * admitted, and fewer than VISIBLE_TARGET showable cards is what asks the effect
 * for another page. Returns how many requests the walk issued before settling.
 */
function simulateForwardWalk(
  pool: string[],
  blocked: (wordId: string) => boolean,
  maxIterations: number,
): { fetches: number; visible: number } {
  const matching = pool.length;
  const entries: FeedEntry[] = [];
  const admitted = new Set<string>();
  let fetches = 0;

  const visibleCount = () =>
    entries.filter((entry) => admitted.has(entry.occurrenceId) || !blocked(entry.word.id)).length;

  // The initial load is not part of the backfill loop; it always happens once.
  entries.push(...makePage(pool, 0));
  fetches += 1;

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    for (const entry of entries) {
      if (!blocked(entry.word.id)) admitted.add(entry.occurrenceId);
    }
    const wantsMore =
      visibleCount() < VISIBLE_TARGET && canWalkFurther(matching, getWalkedPositions(entries));
    if (!wantsMore) break;
    entries.push(...makePage(pool, getWalkedPositions(entries)));
    fetches += 1;
    // maxPages keeps the buffer bounded by dropping the oldest page.
    if (entries.length > bufferCeiling()) {
      entries.splice(0, entries.length - bufferCeiling());
    }
    if (iteration === maxIterations - 1) {
      // The ceiling let the walk run away instead of settling.
      break;
    }
  }
  return { fetches, visible: visibleCount() };
}

/** Positions the infinite query can retain at once. */
function bufferCeiling(): number {
  return VOCAB_PAGE_LIMIT * VOCAB_MAX_PAGES;
}

const pool = Array.from({ length: 25 }, (_, index) => `word-${index}`);
const blockAll = () => true;
const blockNone = () => false;
const blockExcept = (allowed: number[]) => {
  const ids = new Set(allowed.map((index) => `word-${index}`));
  return (wordId: string) => !ids.has(wordId);
};

// ── 1. The pure ceiling ───────────────────────────────────────────────────────
const bufferCeilingSize = bufferCeiling();
assert.equal(canWalkFurther(25, 25), true, "a partially walked pool can still be walked");
assert.equal(canWalkFurther(25, 25 + VOCAB_PAGE_LIMIT), false, "one cycle plus slack is enough");
assert.equal(canWalkFurther(25, 10_000), false, "a long walk never re-arms a small pool");
assert.equal(canWalkFurther(5_000, bufferCeilingSize - 1), true, "buffer room is usable");
assert.equal(canWalkFurther(5_000, bufferCeilingSize), false, "the buffer caps the walk");
assert.equal(
  canWalkFurther(0, bufferCeilingSize - 1),
  true,
  "unknown pool falls back to the buffer",
);
assert.equal(canWalkFurther(0, bufferCeilingSize), false, "unknown pool stays capped");
assert.equal(getWalkedPositions([]), 0, "nothing buffered means nothing walked");
assert.equal(
  getWalkedPositions(makePage(pool, 12)),
  24,
  "walked positions are the last position plus one",
);
console.log("OK — paging ceiling covers one pool cycle and is capped by the buffer");

// ── 2. A fully blocked stream stops after a bounded walk ─────────────────────
const exhaustedRun = simulateForwardWalk(pool, blockAll, 400);
assert.ok(
  exhaustedRun.fetches <= VOCAB_MAX_PAGES,
  `all-blocked walk issued ${exhaustedRun.fetches} requests, expected <= ${VOCAB_MAX_PAGES}`,
);
assert.equal(exhaustedRun.visible, 0, "an exhausted pool shows no cards");
console.log(`OK — fully blocked stream settles after ${exhaustedRun.fetches} requests`);

// ── 3. A healthy stream does not backfill at all ────────────────────────────
const healthyRun = simulateForwardWalk(pool, blockNone, 400);
assert.equal(healthyRun.fetches, 1, "a fresh page of showable words needs no backfill");
assert.ok(healthyRun.visible >= VISIBLE_TARGET, "the first page is already watchable");
console.log("OK — fresh stream settles on the initial page");

// ── 4. A mostly blocked stream still finds every allowed word ───────────────
const fewRun = simulateForwardWalk(pool, blockExcept([3, 7, 11]), 400);
assert.ok(fewRun.visible >= 3, "every allowed word gets a buffered card");
assert.ok(
  fewRun.fetches <= VOCAB_MAX_PAGES,
  `sparse walk issued ${fewRun.fetches} requests, expected <= ${VOCAB_MAX_PAGES}`,
);
console.log(
  `OK — sparse stream buffers its ${fewRun.visible} allowed words in ${fewRun.fetches} requests`,
);

// ── 5. The real catalog cannot be walked away either ─────────────────────────
const catalog = JSON.parse(readFileSync("src/features/vocabulary/data/catalog.json", "utf8")) as {
  words: Array<{ id: string }>;
};
const catalogRun = simulateForwardWalk(
  catalog.words.map((word) => word.id),
  blockAll,
  400,
);
assert.ok(
  catalogRun.fetches <= 5,
  `catalog walk issued ${catalogRun.fetches} requests, expected <= 5`,
);
console.log(
  `OK — real ${catalog.words.length}-word catalog settles after ${catalogRun.fetches} requests`,
);

// ── 6. Repeat caps are what make blocking sticky (documents the premise) ────
const history: ViewHistory = { sticky: [NOW - 60_000] };
assert.equal(isWordAllowed(history, "sticky", NOW), false, "a word viewed today is blocked");
assert.equal(
  isWordAllowed(history, "sticky", NOW + 25 * 60 * 60 * 1000),
  true,
  "and it unlocks again after the day window",
);
console.log("OK — blocked words stay blocked within the day window");

console.log("\nAll vocabulary backfill bounds hold.");
