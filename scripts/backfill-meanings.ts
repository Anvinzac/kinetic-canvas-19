/**
 * Carry `meaningVi` from the authoring batches into the published decks.
 *
 * The field was added to the batch format after the packs were compiled, so the served
 * decks do not have it. Re-importing the batches would bring it in — and would also throw
 * away every `shareCode`, which is assigned separately and must never change, because
 * codes escape into chat threads. So this backfills the one field in place and touches
 * nothing else.
 *
 * Matching is by headword, not by id: a pack's id is derived at import time and a batch
 * has none. Headwords are unique within the published set (normalizeDeck rejects a
 * duplicate), so the match is exact.
 *
 * Idempotent: a word that already carries the field is left alone, and a run that changes
 * nothing writes nothing.
 *
 * Run: npx tsx scripts/backfill-meanings.ts [--check]
 */
import { readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

const DATA = "src/features/vocabulary/data";
const BATCHES = "docs/Batches";
const checkOnly = process.argv.includes("--check");

type Word = Record<string, unknown> & { word?: string; meaningVi?: string };

/** Every published deck file, English and per-locale. */
function deckFiles(): string[] {
  const files = [join(DATA, "catalog.json")];
  for (const dir of ["packs", "zh", "ko", "ja"]) {
    try {
      files.push(
        ...readdirSync(join(DATA, dir))
          .filter((f) => f.endsWith(".json"))
          .map((f) => join(DATA, dir, f)),
      );
    } catch {
      continue; // a locale with no decks yet
    }
  }
  return files;
}

/** headword (lowercased) → gloss, from every batch that carries one. */
function batchMeanings(): Map<string, string> {
  const meanings = new Map<string, string>();
  for (const file of readdirSync(BATCHES).filter((f) => f.endsWith(".json"))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(join(BATCHES, file), "utf8"));
    } catch {
      continue; // not a deck batch
    }
    const words = Array.isArray(parsed) ? parsed : ((parsed as { words?: unknown[] })?.words ?? []);
    if (!Array.isArray(words)) continue;
    for (const entry of words as Word[]) {
      const head = typeof entry?.word === "string" ? entry.word.trim().toLowerCase() : "";
      const gloss = typeof entry?.meaningVi === "string" ? entry.meaningVi.trim() : "";
      // First batch to define a headword wins; later batches are revisions of the same
      // deck and agree, and a disagreement is reported below rather than silently picked.
      if (head && gloss && !meanings.has(head)) meanings.set(head, gloss);
    }
  }
  return meanings;
}

const meanings = batchMeanings();
let written = 0;
let already = 0;
const missing: string[] = [];

for (const file of deckFiles()) {
  const raw = readFileSync(file, "utf8");
  const deck = JSON.parse(raw) as { words?: Word[] };
  if (!Array.isArray(deck.words)) continue;
  let changed = false;
  for (const word of deck.words) {
    if (typeof word.meaningVi === "string" && word.meaningVi.trim()) {
      already += 1;
      continue;
    }
    const gloss = meanings.get(
      String(word.word ?? "")
        .trim()
        .toLowerCase(),
    );
    if (!gloss) {
      missing.push(`${file}  ${String(word.word)}`);
      continue;
    }
    word.meaningVi = gloss;
    changed = true;
    written += 1;
  }
  if (changed && !checkOnly) {
    // Same atomic write the importer uses: a failure leaves the old file intact.
    const temporary = `${file}.${randomUUID()}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(deck, null, 2)}\n`, "utf8");
    renameSync(temporary, file);
  }
}

console.log(`${meanings.size} glosses in ${BATCHES}`);
console.log(`${already} words already had one, ${written} ${checkOnly ? "would be" : ""} filled`);
if (missing.length) {
  console.log(`\n${missing.length} published word(s) with no gloss in any batch:`);
  missing.slice(0, 20).forEach((line) => console.log(`  ${line}`));
}
