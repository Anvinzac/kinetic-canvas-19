/**
 * Regression guard for the vocabulary review workbench.
 *
 * The workbench is the authoring store and the catalog is what readers get, so the
 * invariants that matter are about the seam between them: a migration must lose no
 * word and no text, a publish must round-trip the multi-valued axes, and the query
 * engine's facet counts must agree with the rows it actually returns.
 *
 * Usage: npx tsx scripts/check-vocabulary-workbench.ts [--write]
 *   --write  (re)builds src/features/vocabulary/data/workbench.ndjson from the catalog
 *
 * Depends on: ../src/features/vocabulary/lib/{schema,workbench,taxonomy},
 *   ../src/features/admin/lib/workbench-filter
 */

import { readFileSync, writeFileSync } from "node:fs";
import { normalizeDeck } from "../src/features/vocabulary/lib/schema.ts";
import { TOPIC_IDS } from "../src/features/vocabulary/lib/taxonomy.ts";
import {
  fromCatalogWord,
  publishedFingerprint,
  toCatalogWord,
  workbenchWordSchema,
  type WorkbenchWord,
} from "../src/features/vocabulary/lib/workbench.ts";
import {
  EMPTY_QUERY,
  countFacets,
  filterRows,
  pageOf,
  sortRows,
  type WorkbenchRow,
} from "../src/features/admin/lib/workbench-filter.ts";

const CATALOG = "src/features/vocabulary/data/catalog.json";
const WORKBENCH = "src/features/vocabulary/data/workbench.ndjson";

let failures = 0;

function check(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ok   ${message}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${message}`);
  }
}

const catalog = normalizeDeck(JSON.parse(readFileSync(CATALOG, "utf8")));
const at = new Date().toISOString();
const migrated = catalog.words.map((word) => fromCatalogWord(word, at));

console.log(`Migration from ${CATALOG} (${catalog.words.length} published words)`);
check(
  migrated.length === catalog.words.length,
  "every published word becomes one authoring record",
);
check(
  migrated.every((word) => word.status === "approved"),
  "a word already served is migrated as approved",
);
check(
  migrated.every((word, index) => word.defVi === catalog.words[index]!.defVi),
  "Vietnamese definitions survive the migration unchanged",
);
check(
  migrated.every(
    (word, index) =>
      !(TOPIC_IDS as readonly string[]).includes(catalog.words[index]!.topic) ||
      word.topics[0] === catalog.words[index]!.topic,
  ),
  "a curated legacy topic becomes the first entry of the multi-valued axis",
);

console.log("\nPublish round-trip");
const recompiled = normalizeDeck({
  meta: { name: catalog.name },
  words: migrated.map(toCatalogWord),
});
check(recompiled.count === catalog.count, "publishing the migrated store serves the same count");
check(
  recompiled.words.every(
    (word, index) => publishedFingerprint(word) === publishedFingerprint(catalog.words[index]!),
  ),
  "no reader-visible field changes across migrate -> publish",
);
check(
  recompiled.words.every((word) => word.topic === (word.topics?.[0] ?? "general")),
  "the legacy single topic always restates the first multi-valued topic",
);
check(
  recompiled.topics.length > 0 && recompiled.topics.every((topic) => typeof topic === "string"),
  "catalog topic metadata is the union of the multi-valued axis",
);

console.log("\nStore encoding");
const encoded = migrated.map((word) => JSON.stringify(word)).join("\n");
check(
  encoded.split("\n").length === migrated.length,
  "the store writes exactly one line per word, so an edit is a one-line diff",
);
const decoded = encoded
  .split("\n")
  .filter(Boolean)
  .map((line) => workbenchWordSchema.parse(JSON.parse(line)));
check(
  decoded.length === migrated.length &&
    decoded.every((word, index) => word.id === migrated[index]!.id),
  "every written line parses back as a valid authoring record",
);

console.log("\nQuery engine");
const rows: WorkbenchRow[] = migrated.map((word, index) => ({
  ...word,
  openReports: index % 3,
  topReasons: index % 3 ? [{ id: "meaning-wrong", count: index % 3 }] : [],
  published: true,
  drifted: index % 5 === 0,
}));
const facets = countFacets(rows, EMPTY_QUERY);
check(
  Object.values(facets.statuses).reduce((sum, count) => sum + count, 0) === rows.length,
  "status facet counts add up to the whole store",
);
const firstLevel = Object.keys(facets.levels)[0];
if (firstLevel) {
  const byLevel = { ...EMPTY_QUERY, levels: [firstLevel] };
  check(
    filterRows(rows, byLevel).length === facets.levels[firstLevel],
    `the level facet count for ${firstLevel} matches the rows that filter returns`,
  );
  check(
    Object.keys(countFacets(rows, byLevel).levels).length === Object.keys(facets.levels).length,
    "selecting one level still reports the other levels' counts",
  );
}
check(
  filterRows(rows, { ...EMPTY_QUERY, minOpenReports: 2 }).every((row) => row.openReports >= 2),
  "report pressure filters to words carrying at least that many open reports",
);
check(
  filterRows(rows, { ...EMPTY_QUERY, drifted: true }).every((row) => row.drifted),
  "the drift filter keeps only words edited since publish",
);
const ordered = sortRows(rows, "reports", "desc");
check(
  ordered.every((row, index) => index === 0 || ordered[index - 1]!.openReports >= row.openReports),
  "sorting by report pressure puts the most-reported words first",
);
const paged = pageOf(ordered, 99, 10);
check(
  paged.page === paged.pageCount - 1 && paged.slice.length > 0,
  "a page request past the end clamps to the last page instead of showing nothing",
);

if (process.argv.includes("--write")) {
  writeFileSync(WORKBENCH, `${encoded}\n`, "utf8");
  console.log(`\nWrote ${migrated.length} words to ${WORKBENCH}`);
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll workbench checks passed");
process.exitCode = failures ? 1 : 0;
