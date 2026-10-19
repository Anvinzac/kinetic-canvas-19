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
 * has none. Headwords are unique within ONE language's published set (normalizeDeck
 * rejects a duplicate), so the match is exact.
 *
 * Batches live per language under docs/Batches/<locale>/, mirroring how the served decks
 * are split (data/packs for English, data/<locale> for the rest). Each language is matched
 * only against its own batches — a French headword must never pick up a gloss because the
 * same spelling happens to exist in an English deck.
 *
 * Idempotent: a word that already carries the field is left alone, and a run that changes
 * nothing writes nothing.
 *
 * Run: npx tsx scripts/backfill-meanings.ts [--check]
 */
import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

const DATA = "src/features/vocabulary/data";
const BATCHES = "docs/Batches";
const checkOnly = process.argv.includes("--check");

type Word = Record<string, unknown> & { word?: string; meaningVi?: string };

/**
 * Where each language's batches are authored and where its compiled decks are served.
 *
 * English is the odd one: its decks are the admin-editable base plus every provider pack,
 * while another language is a single folder. French, German and Spanish are listed with no
 * served decks yet — their batches exist and will compile into data/<locale>/ when they do,
 * and listing them now means that day needs no change here.
 */
const LANGUAGES: { locale: string; decks: string[] }[] = [
  { locale: "en", decks: [join(DATA, "catalog.json"), join(DATA, "packs")] },
  { locale: "zh", decks: [join(DATA, "zh")] },
  { locale: "ko", decks: [join(DATA, "ko")] },
  { locale: "ja", decks: [join(DATA, "ja")] },
  { locale: "fr", decks: [join(DATA, "fr")] },
  { locale: "de", decks: [join(DATA, "de")] },
  { locale: "es", decks: [join(DATA, "es")] },
];

/** Expand a list of files and folders into the deck files that exist. */
function deckFiles(entries: string[]): string[] {
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.endsWith(".json")) {
      if (existsSync(entry)) files.push(entry);
      continue;
    }
    try {
      files.push(
        ...readdirSync(entry)
          .filter((f) => f.endsWith(".json"))
          .map((f) => join(entry, f)),
      );
    } catch {
      continue; // a locale with no decks yet
    }
  }
  return files;
}

/** headword (lowercased) → gloss, from ONE language's batches. */
function batchMeanings(locale: string): Map<string, string> {
  const meanings = new Map<string, string>();
  const dir = join(BATCHES, locale);
  let entries: string[];
  try {
    entries = readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    return meanings; // no batches authored for this language yet
  }
  for (const file of entries) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(join(dir, file), "utf8"));
    } catch {
      continue; // not a deck batch
    }
    const words = Array.isArray(parsed) ? parsed : ((parsed as { words?: unknown[] })?.words ?? []);
    if (!Array.isArray(words)) continue;
    for (const entry of words as Word[]) {
      const head = typeof entry?.word === "string" ? entry.word.trim().toLowerCase() : "";
      const gloss = typeof entry?.meaningVi === "string" ? entry.meaningVi.trim() : "";
      // First batch to define a headword wins; later batches are revisions of the same
      // deck and agree.
      if (head && gloss && !meanings.has(head)) meanings.set(head, gloss);
    }
  }
  return meanings;
}

let written = 0;
let already = 0;
const missing: string[] = [];

for (const { locale, decks } of LANGUAGES) {
  const meanings = batchMeanings(locale);
  const files = deckFiles(decks);
  if (!meanings.size && !files.length) continue;
  console.log(
    `${locale}: ${meanings.size} gloss(es) in ${join(BATCHES, locale)}, ${files.length} deck file(s)`,
  );
  for (const file of files) {
    const deck = JSON.parse(readFileSync(file, "utf8")) as { words?: Word[] };
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
}

console.log(
  `\n${already} words already had a gloss, ${written} ${checkOnly ? "would be" : ""} filled`,
);
if (missing.length) {
  console.log(`\n${missing.length} published word(s) with no gloss in their language's batches:`);
  missing.slice(0, 20).forEach((line) => console.log(`  ${line}`));
}
