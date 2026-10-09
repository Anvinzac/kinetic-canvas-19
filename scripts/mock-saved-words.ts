/**
 * Seed this device's saved page with mock bookmarked and hearted words.
 *
 * The saved page reads nothing but the per-device reaction store in localStorage
 * (`kinetic.vocab.reactions`), resolved against the bundled catalog. There is no server
 * state to fixture, so this script builds that one blob from REAL catalog ids and prints
 * it as a paste-ready snippet — nothing in the app ships a seeding path.
 *
 * The spread is chosen to exercise the page rather than just fill it:
 *   - both tabs populated, with an overlap set that is bookmarked AND hearted;
 *   - several day buckets, so "Hôm nay"/"Hôm qua"/relative and day/month labels all render;
 *   - one group pushed past FOLDER_CAP (15), so folder splitting shows up;
 *   - one word left unstamped, which files it under "Chưa xác định";
 *   - mixed CEFR levels, so the "Theo cấp độ" lens has more than one band;
 *   - tap counts above 1 and a couple of emoji tallies.
 *
 * Writing a stamp only on the matching reaction is deliberate: `readReactions` drops a
 * `savedAt` whose `bookmark` is not true (and a `heartedAt` without `heart`), so a
 * mismatched fixture would silently lose its dates.
 *
 * Usage: npm run mock:saved          (then paste the snippet into DevTools)
 */
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mergeCatalogs } from "../src/features/vocabulary/lib/schema.ts";
import type { Catalog } from "../src/features/vocabulary/lib/schema.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "../src/features/vocabulary/data");

/** Same merge the app does, so every id below is one the saved page can resolve. */
async function loadCatalog(): Promise<Catalog> {
  const base = (await import(join(dataDir, "catalog.json"), { with: { type: "json" } })).default;
  const packDir = join(dataDir, "packs");
  let packs: Catalog[] = [];
  try {
    packs = await Promise.all(
      readdirSync(packDir)
        .filter((f) => f.endsWith(".json"))
        .sort()
        .map(async (f) => (await import(join(packDir, f), { with: { type: "json" } })).default),
    );
  } catch {
    // No packs compiled: the base catalog alone is a valid deck.
  }
  return mergeCatalogs(base as Catalog, ...packs);
}

type ReactionEntry = {
  heart?: boolean;
  bookmark?: boolean;
  heartTaps?: number;
  bookmarkTaps?: number;
  heartedAt?: number;
  savedAt?: number;
  emojis?: Record<string, number>;
};

const catalog = await loadCatalog();
const ids = catalog.words.map((w) => w.id);
if (ids.length < 24) {
  console.error(
    `The catalog only holds ${ids.length} words; this fixture needs 24+ to fill a folder split.`,
  );
  process.exit(1);
}

const midnight = new Date();
midnight.setHours(9, 30, 0, 0);
const at = (daysAgo: number, minute = 0) => midnight.getTime() - daysAgo * DAY_MS + minute * 60_000;

const store: Record<string, ReactionEntry> = {};

/** Bookmark a word, stamped on a given day. */
function bookmark(id: string, daysAgo: number, minute: number, taps = 1): void {
  const entry = (store[id] ??= {});
  entry.bookmark = true;
  entry.bookmarkTaps = taps;
  entry.savedAt = at(daysAgo, minute);
}

/** Heart a word, stamped on a given day. */
function heart(id: string, daysAgo: number, minute: number, taps = 1): void {
  const entry = (store[id] ??= {});
  entry.heart = true;
  entry.heartTaps = taps;
  entry.heartedAt = at(daysAgo, minute);
}

// Today: a big bookmark group, 18 words, so it splits into folders at the cap of 15.
ids.slice(0, 18).forEach((id, i) => bookmark(id, 0, i, 1 + (i % 3)));
// Yesterday and the day before: smaller groups that stay a single folder.
ids.slice(18, 22).forEach((id, i) => bookmark(id, 1, i));
ids.slice(22, 24).forEach((id, i) => bookmark(id, 2, i));
// Far enough back that the relative words give way to a day/month label.
if (ids[24]) bookmark(ids[24], 9, 0);

// Hearts: overlap the first four bookmarks, then stand alone further down the deck.
ids.slice(0, 4).forEach((id, i) => heart(id, 0, i, 2));
ids.slice(24, 30).forEach((id, i) => heart(id, 1, i));
ids.slice(30, 34).forEach((id, i) => heart(id, 4, i));

// One bookmark with no stamp at all -> "Chưa xác định".
const undated = ids.at(-1)!;
store[undated] = { ...(store[undated] ?? {}), bookmark: true, bookmarkTaps: 1 };
delete store[undated].savedAt;

// A couple of emoji tallies, so the reaction strip has something to show.
if (ids[0]) store[ids[0]]!.emojis = { "🔥": 3, "😍": 1 };
if (ids[1]) store[ids[1]]!.emojis = { "👏": 2 };

const bookmarked = Object.values(store).filter((e) => e.bookmark).length;
const hearted = Object.values(store).filter((e) => e.heart).length;

console.log(`Catalog: ${ids.length} words`);
console.log(
  `Mock:    ${bookmarked} bookmarked, ${hearted} hearted, ${Object.keys(store).length} records`,
);
console.log(`         today's bookmark group holds 18 -> splits at FOLDER_CAP 15`);
console.log(`         "${undated}" is left unstamped -> files under "Chưa xác định"\n`);
console.log("Paste this into the DevTools console on the feed, then reload:\n");
console.log(
  `localStorage.setItem('kinetic.vocab.reactions', ${JSON.stringify(JSON.stringify(store))}); location.reload()`,
);
