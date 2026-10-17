/**
 * Guard: every clue field of every shipped deck pages into scenes worth showing.
 *
 * The code guards (check-text-pagination) prove the splitter obeys its rules. They
 * cannot prove a DECK does not hit a shape nobody thought of — which is exactly how five
 * words shipped whose clue ended on a scene containing a single `”` and nothing else.
 * This runs the real paginator over the real decks and asserts the result, so a new deck
 * line is checked against the reader rather than hoped about.
 *
 * Run: npx tsx scripts/check-deck-pages.ts
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getWords } from "../src/features/kinetic-text";
import { paginateText } from "../src/features/post-player/lib/paginate";

/** Matches MIN_PAGE_SYLLABLES in paginate.ts; a page beside another may not go below. */
const MIN_PAGE_SYLLABLES = 4;
const DATA = "src/features/vocabulary/data";
const HAS_GLYPH = /[\p{L}\p{N}]/u;

/** The decks the app actually serves: the base catalog plus every pack, every locale. */
function deckFiles(): string[] {
  const files = [join(DATA, "catalog.json")];
  for (const dir of ["packs", "zh", "ko", "ja"]) {
    let entries: string[] = [];
    try {
      entries = readdirSync(join(DATA, dir));
    } catch {
      continue; // a locale with no decks yet
    }
    files.push(...entries.filter((f) => f.endsWith(".json")).map((f) => join(DATA, dir, f)));
  }
  return files;
}

/** The fields buildStages turns into kinetic pages. */
function pagedFields(word: Record<string, unknown>): string[] {
  const usage = (word.usage as { vi?: string }[] | undefined) ?? [];
  return [word.leadVi, word.anticipateVi, word.defVi, ...usage.map((u) => u?.vi)].filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
}

/**
 * How a field reaches the paginator at runtime: `_` and `=` have become a no-break space
 * and `|` has been stripped, both in encodeWordJoiners when the catalog loaded.
 */
function asLoaded(raw: string): string {
  return raw.replace(/[_=]/g, " ").replace(/\|/g, "");
}

const thin: string[] = [];
let fields = 0;
let pages = 0;

for (const file of deckFiles()) {
  const parsed = JSON.parse(readFileSync(file, "utf8")) as { words?: Record<string, unknown>[] };
  for (const word of parsed.words ?? []) {
    for (const raw of pagedFields(word)) {
      const text = asLoaded(raw);
      const split = paginateText(text, { keepPhraseEdges: true });
      fields += 1;
      pages += split.length;
      // A single page is whatever the field is; the floor is about a page beside another.
      if (split.length < 2) continue;
      for (const page of split) {
        const real = getWords(page).filter((token) => HAS_GLYPH.test(token)).length;
        if (real < MIN_PAGE_SYLLABLES) {
          thin.push(`  ${file}  ${String(word.id)}  [${real} syllable(s)] ${JSON.stringify(page)}`);
        }
      }
    }
  }
}

console.log(`${fields} paged deck fields -> ${pages} scenes`);
if (fields === 0) {
  console.error("FAIL — no deck fields were read; the guard would pass vacuously.");
  process.exit(1);
}
if (thin.length > 0) {
  console.error(`\nFAIL — ${thin.length} scene(s) below ${MIN_PAGE_SYLLABLES} syllables:`);
  thin.forEach((line) => console.error(line));
  process.exit(1);
}
console.log(`OK — every scene beside another carries at least ${MIN_PAGE_SYLLABLES} syllables.`);
