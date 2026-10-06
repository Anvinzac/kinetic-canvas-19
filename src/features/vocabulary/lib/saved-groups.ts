/**
 * Groups a saved-word list into sections a reader can actually scan, then chunks each
 * section into folders of at most FOLDER_CAP words.
 *
 * Two lenses, both asked for: the day a word was saved, and its CEFR level. Words with no
 * recoverable date collect in one clearly-labelled last group rather than being invented
 * a day. Folder splitting is what keeps a busy group from turning into one long scroll.
 *
 * Exports: FOLDER_CAP, GroupMode, GROUP_MODES, WordFolder, WordGroup, dayLabel,
 *   groupSavedWords
 * Depends on: ./schema (LEVELS), ./saved-words (type only)
 */

import { LEVELS } from "./schema";
import type { SavedWord } from "./saved-words";

/** Hard ceiling on how many words one folder may hold. */
export const FOLDER_CAP = 15;

export type GroupMode = "day" | "level";

/** The grouping switch's options, in the order they are offered. */
export const GROUP_MODES: { id: GroupMode; label: string }[] = [
  { id: "day", label: "Theo ngày" },
  { id: "level", label: "Theo cấp độ" },
];

export type WordFolder = {
  id: string;
  /** "" when the group holds a single folder, so the group label is not repeated. */
  label: string;
  words: SavedWord[];
};

export type WordGroup = {
  id: string;
  label: string;
  /** Quiet second line, e.g. the Vietnamese name of a CEFR band. */
  hint?: string;
  count: number;
  folders: WordFolder[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Bucket label for words the device never stamped. */
export const UNDATED_LABEL = "Chưa xác định";

/** Bucket label for a word that reached the catalog without a level. */
const UNLEVELLED_LABEL = "Chưa phân loại";

/** CEFR codes named the way Vietnamese learners name them. */
const LEVEL_BAND_VI: Record<string, string> = {
  A1: "Sơ cấp",
  A2: "Sơ cấp",
  B1: "Trung cấp",
  B2: "Trung cấp",
  C1: "Cao cấp",
  C2: "Cao cấp",
};

function startOfDay(ts: number): number {
  const day = new Date(ts);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

/**
 * Calendar-day label in Vietnamese: the three relative words a reader thinks in, then a
 * plain day/month, gaining a year only once the words stop applying across one.
 * @param ts - Any timestamp inside the day
 * @param now - Reference "today"
 * @returns Short label
 */
export function dayLabel(ts: number, now: number): string {
  const days = Math.round((startOfDay(now) - startOfDay(ts)) / DAY_MS);
  if (days <= 0) return "Hôm nay";
  if (days === 1) return "Hôm qua";
  if (days === 2) return "Hôm kia";
  const date = new Date(ts);
  const label = `${date.getDate()}/${date.getMonth() + 1}`;
  return date.getFullYear() === new Date(now).getFullYear()
    ? label
    : `${label}/${date.getFullYear()}`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const parts: T[][] = [];
  for (let at = 0; at < items.length; at += size) parts.push(items.slice(at, at + size));
  return parts;
}

/** Split one group's words into folders, skipping the extra heading when there is only one. */
function toFolders(groupId: string, words: SavedWord[]): WordFolder[] {
  if (words.length <= FOLDER_CAP) return [{ id: `${groupId}#1`, label: "", words }];
  return chunk(words, FOLDER_CAP).map((part, index) => ({
    id: `${groupId}#${index + 1}`,
    label: `Mục ${index + 1}`,
    words: part,
  }));
}

/** Newest save first; undated words keep the order the device saved them in. */
function byNewestSave(a: SavedWord, b: SavedWord): number {
  if (a.savedAt && b.savedAt) return b.savedAt - a.savedAt;
  if (a.savedAt) return -1;
  if (b.savedAt) return 1;
  return 0;
}

function makeGroup(id: string, label: string, words: SavedWord[], hint?: string): WordGroup {
  return { id, label, hint, count: words.length, folders: toFolders(id, words) };
}

function groupByDay(words: SavedWord[], now: number): WordGroup[] {
  const buckets = new Map<number, SavedWord[]>();
  const undated: SavedWord[] = [];
  for (const entry of words) {
    if (!entry.savedAt) {
      undated.push(entry);
      continue;
    }
    const day = startOfDay(entry.savedAt);
    const bucket = buckets.get(day);
    if (bucket) bucket.push(entry);
    else buckets.set(day, [entry]);
  }
  const groups = [...buckets.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([day, list]) =>
      makeGroup(`day-${day}`, dayLabel(day, now), [...list].sort(byNewestSave)),
    );
  if (undated.length) groups.push(makeGroup("day-undated", UNDATED_LABEL, undated));
  return groups;
}

function groupByLevel(words: SavedWord[]): WordGroup[] {
  const buckets = new Map<string, SavedWord[]>();
  for (const entry of words) {
    const level = entry.word.level || UNLEVELLED_LABEL;
    const bucket = buckets.get(level);
    if (bucket) bucket.push(entry);
    else buckets.set(level, [entry]);
  }
  const rank = (level: string) => {
    const at = (LEVELS as readonly string[]).indexOf(level);
    return at === -1 ? LEVELS.length : at;
  };
  return [...buckets.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]))
    .map(([level, list]) =>
      makeGroup(`level-${level}`, level, [...list].sort(byNewestSave), LEVEL_BAND_VI[level]),
    );
}

/**
 * Group and folder a saved-word list.
 * @param words - The active tab's words
 * @param mode - Day or level
 * @param now - Reference time for the relative day labels
 * @returns Groups in reading order, each split into folders of at most FOLDER_CAP words
 */
export function groupSavedWords(
  words: SavedWord[],
  mode: GroupMode,
  now: number = Date.now(),
): WordGroup[] {
  return mode === "day" ? groupByDay(words, now) : groupByLevel(words);
}
