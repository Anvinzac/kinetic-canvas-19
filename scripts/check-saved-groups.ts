/**
 * Assert the saved-page grouping rules that the UI cannot enforce itself.
 *
 * The reader asked for words filed by day and by difficulty, in sub-folders that never
 * exceed 15 words. That ceiling and the ordering around it are pure logic over a list of
 * words, so this script locks them in without a browser:
 *   1. FOLDER_CAP: any group over the cap splits, and no folder is ever over it.
 *   2. A group at or under the cap stays one folder with no extra heading.
 *   3. Day labels: the three relative words, then day/month, then day/month/year.
 *   4. Group order (newest first), undated words last, and nothing lost or duplicated.
 *   5. Level order follows the catalog's CEFR ranking, with the Vietnamese band name.
 *
 * Usage: npm run check:saved-groups
 */
import {
  FOLDER_CAP,
  UNDATED_LABEL,
  dayLabel,
  groupSavedWords,
} from "../src/features/vocabulary/lib/saved-groups.ts";
import type { SavedWord } from "../src/features/vocabulary/lib/saved-words.ts";
import type { VocabularyWord } from "../src/features/vocabulary/lib/schema.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const failures: string[] = [];
const rows: string[] = [];

function check(name: string, pass: boolean): void {
  rows.push(`${pass ? "PASS" : "FAIL"}  ${name}`);
  if (!pass) failures.push(name);
}

/** Local noon, so subtracting whole days can never land on the wrong calendar date. */
function noon(year: number, monthIndex: number, day: number): number {
  return new Date(year, monthIndex, day, 12, 0, 0).getTime();
}

/** Minimal SavedWord; the grouping only reads id, level and savedAt. */
function entry(id: string, savedAt: number | undefined, level = "B1"): SavedWord {
  const word = { id, word: id, level } as unknown as VocabularyWord;
  return { word, hearted: false, bookmarked: true, savedAt };
}

/** One entry per index, all on the same day, `count` deep. Ids stay unique across days. */
function sameDay(count: number, dayOffset = 0): SavedWord[] {
  const now = noon(2026, 9, 6);
  const base = now - dayOffset * DAY_MS;
  return Array.from({ length: count }, (_, i) =>
    entry(`d${dayOffset}w${String(i).padStart(2, "0")}`, base - i),
  );
}

const foldersOf = (words: SavedWord[], now?: number) =>
  groupSavedWords(words, "day", now).flatMap((group) => group.folders);

// ── 1. the folder ceiling ─────────────────────────────────────────────────────
check(`the cap is 15 words per folder`, FOLDER_CAP === 15);

const sixteen = foldersOf(sameDay(16));
check(
  "16 words in one day split into 15 + 1",
  sixteen.map((folder) => folder.words.length).join(",") === "15,1",
);

const fortySix = foldersOf(sameDay(46));
check(
  "46 words split into 15 + 15 + 15 + 1",
  fortySix.map((folder) => folder.words.length).join(",") === "15,15,15,1",
);
check(
  "no folder ever exceeds the cap",
  fortySix.every((folder) => folder.words.length <= FOLDER_CAP),
);
check(
  "split folders are numbered for the reader",
  fortySix.map((folder) => folder.label).join("|") === "Mục 1|Mục 2|Mục 3|Mục 4",
);

// ── 2. a group that fits stays flat ───────────────────────────────────────────
const fifteen = foldersOf(sameDay(15));
check(
  "exactly 15 words is still one folder",
  fifteen.length === 1 && fifteen[0].words.length === 15,
);
check("a single folder carries no extra heading", fifteen.length === 1 && fifteen[0].label === "");

// ── 3. day labels ─────────────────────────────────────────────────────────────
const now = noon(2026, 9, 6);
check("today reads Hôm nay", dayLabel(now, now) === "Hôm nay");
check("yesterday reads Hôm qua", dayLabel(now - DAY_MS, now) === "Hôm qua");
check("two days back reads Hôm kia", dayLabel(now - 2 * DAY_MS, now) === "Hôm kia");
check(
  "three days back loses the word and gains a date",
  dayLabel(now - 3 * DAY_MS, now) === "3/10",
);
check("a date in the same year stays day/month", dayLabel(noon(2026, 2, 9), now) === "9/3");
check(
  "a date across the year boundary gains its year",
  dayLabel(noon(2025, 11, 29), now) === "29/12/2025",
);
check(
  "a stamp taken after the reference moment still reads Hôm nay",
  dayLabel(now + 3_600_000, now) === "Hôm nay",
);

// ── 4. order and completeness ─────────────────────────────────────────────────
const mixed = [
  ...sameDay(2, 0),
  ...sameDay(2, 1),
  ...sameDay(2, 2),
  entry("undated-a", undefined),
  entry("undated-b", undefined),
];
const dayGroups = groupSavedWords(mixed, "day", now);
check(
  "day groups run newest first",
  dayGroups.map((group) => group.label).join(" → ") ===
    "Hôm nay → Hôm qua → Hôm kia → Chưa xác định",
);
check("the undated bucket is always last", dayGroups.at(-1)?.label === UNDATED_LABEL);
check(
  "every word appears in exactly one group",
  dayGroups.reduce((sum, group) => sum + group.count, 0) === mixed.length &&
    new Set(
      dayGroups.flatMap((group) => group.folders.flatMap((f) => f.words.map((w) => w.word.id))),
    ).size === mixed.length,
);
check(
  "a group's count matches the words it renders",
  dayGroups.every((group) => group.folders.every((folder) => folder.words.length <= group.count)) &&
    dayGroups.every(
      (group) => group.folders.reduce((sum, f) => sum + f.words.length, 0) === group.count,
    ),
);
check(
  "the newest save leads inside a group",
  groupSavedWords([entry("older", now - 60_000), entry("newer", now)], "day", now)[0]?.folders[0]
    ?.words[0]?.word.id === "newer",
);

// ── 5. level grouping ─────────────────────────────────────────────────────────
const byLevel = [
  entry("c2", now, "C2"),
  entry("b2-1", now, "B2"),
  entry("b2-2", now - 1, "B2"),
  entry("a2", now, "A2"),
  entry("b1", now, "B1"),
  entry("unlevelled", now, ""),
];
const levelGroups = groupSavedWords(byLevel, "level", now);
check(
  "levels run easiest first",
  levelGroups.map((group) => group.label).join(" → ") === "A2 → B1 → B2 → C2 → Chưa phân loại",
);
check(
  "CEFR bands carry their Vietnamese name",
  levelGroups.map((group) => group.hint ?? "").join(" / ") ===
    "Sơ cấp / Trung cấp / Trung cấp / Cao cấp / ",
);
check(
  "level mode folders obey the same ceiling",
  groupSavedWords(sameDay(40, 0), "level", now).every((group) =>
    group.folders.every((folder) => folder.words.length <= FOLDER_CAP),
  ),
);

if (failures.length) {
  console.log(rows.join("\n"));
  console.error(
    `\n${failures.length} saved-groups failure(s):\n${failures.map((f) => `  - ${f}`).join("\n")}`,
  );
  process.exitCode = 1;
} else {
  console.log(rows.join("\n"));
  console.log(`\n${rows.length} saved-groups assertions passed.`);
}
