/**
 * Guard: every published English word carries the short gloss the reveal panel shows.
 *
 * The panel falls back to `defVi` when `meaningVi` is absent, which is right for a deck
 * authored before the field existed — and is exactly why a missing gloss would otherwise
 * be invisible. A new pack compiled without one would quietly show the long clue sentence
 * again on the one page it was removed from, and nothing would say so.
 *
 * Chinese decks are exempt: no gloss has been authored for them, so they legitimately run
 * on the fallback. The exemption is counted and printed rather than assumed, so it cannot
 * silently grow to cover a deck that should have glosses.
 *
 * Run: npx tsx scripts/check-meanings.ts
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { stripWordJoiners } from "../src/features/vocabulary/lib/word-joiner";

const DATA = "src/features/vocabulary/data";
/** A gloss is a word or two. Past this it has stopped being a gloss and is a sentence. */
const MAX_GLOSS_WORDS = 6;

let failures = 0;
function fail(message: string) {
  failures += 1;
  console.error(`FAIL — ${message}`);
}

function packs(dir: string): string[] {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => join(dir, f));
  } catch {
    return [];
  }
}

type Word = { id?: string; word?: string; meaningVi?: string; defVi?: string };

const english = [join(DATA, "catalog.json"), ...packs(join(DATA, "packs"))];
const exempt = [...packs(join(DATA, "zh")), ...packs(join(DATA, "ko")), ...packs(join(DATA, "ja"))];

let checked = 0;
let longest = { word: "", gloss: "", count: 0 };

for (const file of english) {
  const deck = JSON.parse(readFileSync(file, "utf8")) as { words?: Word[] };
  for (const word of deck.words ?? []) {
    checked += 1;
    const gloss = (word.meaningVi ?? "").trim();
    if (!gloss) {
      fail(`${file}: "${word.word}" has no meaningVi — the panel would fall back to defVi`);
      continue;
    }
    // Counted on the joined-out text: "tò_mò" is one word to a reader, not two.
    const count = stripWordJoiners(gloss).split(/\s+/).filter(Boolean).length;
    if (count > MAX_GLOSS_WORDS) {
      fail(`${file}: "${word.word}" gloss is ${count} words, not a gloss: "${gloss}"`);
    }
    if (count > longest.count) longest = { word: String(word.word), gloss, count };
    // The whole point of the change: the gloss must not simply be the sentence again.
    if (gloss === (word.defVi ?? "").trim()) {
      fail(`${file}: "${word.word}" meaningVi is identical to defVi`);
    }
  }
}

let exemptCount = 0;
for (const file of exempt) {
  const deck = JSON.parse(readFileSync(file, "utf8")) as { words?: Word[] };
  for (const word of deck.words ?? []) {
    if (!(word.meaningVi ?? "").trim()) exemptCount += 1;
  }
}

if (checked === 0) {
  fail("no published English words were read; this guard would pass vacuously");
}

console.log(`${checked} published English words checked, all with a gloss`);
console.log(`longest gloss: "${longest.gloss}" (${longest.count} words, ${longest.word})`);
console.log(`${exemptCount} non-English words running on the defVi fallback, as expected`);
if (failures > 0) {
  console.error(`\n${failures} meaning check(s) failed.`);
  process.exit(1);
}
console.log("OK — every published English word has a short gloss for the reveal panel.");
