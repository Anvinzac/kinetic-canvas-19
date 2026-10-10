/**
 * Difficulty tracks: the learner-facing names shown in the feed's dropdown, and
 * the CEFR level bands each one selects.
 *
 * The catalog tags words with CEFR levels only, so a track is a curated lens over
 * those levels rather than a separate per-word attribute. The bands deliberately
 * overlap: ten named intents cannot map one-to-one onto six CEFR levels without
 * either collapsing two tracks into the same words or leaving tracks empty, and
 * an empty track is worse than a shared one. Every band is distinct as a set, and
 * every band intersects the levels the bundled deck actually carries, so no track
 * renders an empty stream.
 *
 * Exports: DifficultyTrack, DIFFICULTY_TRACKS, DIFFICULTY_IDS, DIFFICULTY_ALL,
 *          LEVEL_SAMPLE_PRIORITY,
 *          difficultyLevels, formatLevelBand, countTrackWords,
 *          trackCeiling, isTrackAvailable
 * Depends on: ./schema
 */

import { LEVELS, type VocabularyLevel } from "./schema";

export type DifficultyTrack = {
  /** URL-safe id, sent to the feed endpoint as `difficulty`. */
  id: string;
  /** Vietnamese label shown in the dropdown. */
  label: string;
  /** One-line gloss so a track is more than a name. */
  hint: string;
  /** Emoji that denotes this track's rung on the difficulty ladder. */
  emoji: string;
  /** CEFR levels this track admits. */
  levels: VocabularyLevel[];
  /**
   * Which level's sample word is shown in the onboarding picker.
   * Defaults to trackCeiling() (the hardest level) when omitted.
   * Set explicitly on vỡ lòng so the first rung shows truly basic A1 words
   * rather than the A2 business terms in the base catalog.
   */
  sampleLevel?: VocabularyLevel;
};

/** Sentinel for "no track chosen" — the endpoint accepts it alongside a track id. */
export const DIFFICULTY_ALL = "";

/**
 * Illustrative pack sizes shown in the difficulty dropdown before the first feed page
 * resolves (the real per-level counts arrive with the page metadata). These are
 * aspirational targets for the deck, not a live tally — the feed endpoint's
 * levelCounts replace them once loaded.
 */
export const MOCK_TOTAL_WORDS = 1200;

const MOCK_TRACK_WORDS: Record<string, number> = {
  "vo-long": 150,
  "co-ban": 120,
  "du-lich": 220,
  "doc-hieu": 260,
  "giao-tiep": 300,
  "chuyen-sau": 180,
  "nang-cao": 240,
  "viet-lach": 200,
  "du-hoc": 320,
  "van-chuong": 210,
};

/**
 * Illustrative word count for one track's dropdown row.
 * @param trackId A difficulty track id
 * @returns The mock pack size, 0 for an unknown id
 * @pure true
 */
export function mockTrackWordCount(trackId: string): number {
  return MOCK_TRACK_WORDS[trackId] ?? 0;
}

/**
 * Words that should appear first in the onboarding sample pool for each level.
 * The base catalog carries business A2 words (deadline, feedback…) that would be
 * shown as the first A2 samples under the old catalog-order rule; listing specific
 * everyday words here ensures the representative shown for each level is one that
 * a learner would actually recognise at that difficulty.
 */
export const LEVEL_SAMPLE_PRIORITY: Partial<Record<VocabularyLevel, readonly string[]>> = {
  A1: ["hungry", "thirsty", "tired", "angry"],
  A2: ["proud", "honest", "polite", "lazy"],
};

/** The ten tracks, in the order the dropdown lists them. */
export const DIFFICULTY_TRACKS: readonly DifficultyTrack[] = [
  {
    id: "vo-long",
    label: "vỡ lòng",
    hint: "Mới bắt đầu, toàn từ rất quen",
    emoji: "🐣",
    levels: ["A1", "A2"],
    sampleLevel: "A1",
  },
  {
    id: "co-ban",
    label: "cơ bản",
    hint: "Vốn từ nền tảng hằng ngày",
    emoji: "🌱",
    levels: ["A2"],
    sampleLevel: "A2",
  },
  {
    id: "du-lich",
    label: "du lịch",
    hint: "Đủ dùng khi đi xa",
    emoji: "🌿",
    levels: ["A2", "B1"],
  },
  {
    id: "doc-hieu",
    label: "đọc hiểu",
    hint: "Đọc báo và đọc truyện",
    emoji: "🍃",
    levels: ["B1", "B2"],
  },
  {
    id: "giao-tiep",
    label: "giao tiếp",
    hint: "Nói chuyện tự nhiên hơn",
    emoji: "🌾",
    levels: ["A1", "A2", "B1"],
  },
  {
    id: "chuyen-sau",
    label: "chuyên sâu",
    hint: "Sắc thái và cách dùng",
    emoji: "🌳",
    levels: ["B2"],
  },
  {
    id: "nang-cao",
    label: "nâng cao",
    hint: "Từ trừu tượng hơn",
    emoji: "⚡",
    levels: ["B2", "C1"],
  },
  {
    id: "viet-lach",
    label: "viết lách",
    hint: "Chữ nghĩa dùng khi viết",
    emoji: "🔥",
    levels: ["B1", "C1"],
  },
  {
    id: "du-hoc",
    label: "du học",
    hint: "Tiếng Anh học thuật",
    emoji: "🚀",
    levels: ["B1", "B2", "C1"],
  },
  {
    id: "van-chuong",
    label: "văn chương",
    hint: "Ngôn từ đẹp và hiếm",
    emoji: "🧠",
    levels: ["B2", "C1", "C2"],
  },
];

/** Every track id, for request validation. */
export const DIFFICULTY_IDS = DIFFICULTY_TRACKS.map((track) => track.id);

/**
 * The hardest CEFR level a track reaches — the level that makes it THAT track.
 * @param track A difficulty track
 * @returns Its highest level in the canonical CEFR order
 * @pure true
 */
export function trackCeiling(track: DifficultyTrack): VocabularyLevel {
  const ordered = LEVELS.filter((level) => track.levels.includes(level));
  return ordered[ordered.length - 1] ?? track.levels[0]!;
}

/**
 * Whether the catalog can actually serve a track yet.
 *
 * Bands overlap, so a track whose own top level is missing would still "work" by quietly
 * streaming the easier words it shares with the track below — "nâng cao" (B2–C1) with no
 * C1 words is just "chuyên sâu" (B2) under another name. That is a promise the deck cannot
 * keep, so a track is on offer only once the level that defines it has words; until then
 * it is listed, greyed, at zero.
 * @param track A difficulty track
 * @param catalogLevels Levels the catalog has at least one word for
 * @returns True when the track's ceiling level is populated
 * @pure true
 */
export function isTrackAvailable(
  track: DifficultyTrack,
  catalogLevels: readonly VocabularyLevel[],
): boolean {
  return catalogLevels.includes(trackCeiling(track));
}

/**
 * Resolve a `difficulty` value into the CEFR levels it admits. A difficulty is a
 * comma-joined list of track ids (multi-select), so the admitted band is the UNION of
 * every chosen track's levels, ordered by the canonical CEFR sequence.
 *
 * Given `catalogLevels`, tracks the catalog cannot serve yet (see isTrackAvailable)
 * contribute nothing — so a selection made only of such tracks admits NO words, rather
 * than falling back to "everything".
 * @param difficulty Comma-joined track ids, or the empty sentinel for "all"
 * @param catalogLevels Levels the catalog has words for; omit to skip the availability rule
 * @returns The union band, an empty band when tracks were chosen but none can be served,
 *   or null when no track is chosen
 * @pure true
 */
export function difficultyLevels(
  difficulty: string,
  catalogLevels?: readonly VocabularyLevel[],
): VocabularyLevel[] | null {
  const ids = difficulty
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (!ids.length) return null;
  const union = new Set<VocabularyLevel>();
  for (const id of ids) {
    const track = DIFFICULTY_TRACKS.find((entry) => entry.id === id);
    if (!track) continue;
    if (catalogLevels && !isTrackAvailable(track, catalogLevels)) continue;
    for (const level of track.levels) union.add(level);
  }
  return LEVELS.filter((level) => union.has(level));
}

/**
 * Human-readable band for a dropdown row, e.g. "A1–A2" or "B2".
 * @param levels The track's CEFR band
 * @returns A compact band label
 * @pure true
 */
export function formatLevelBand(levels: readonly VocabularyLevel[]): string {
  if (levels.length === 1) return levels[0];
  // Order by the canonical CEFR sequence, not by declaration order.
  const ordered = LEVELS.filter((level) => levels.includes(level));
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  return first && last && first !== last ? `${first}–${last}` : (first ?? "");
}

/**
 * How many words a set of tracks streams, given the catalog's per-level counts.
 *
 * Tracks overlap on purpose (see the header), so the size of a multi-track selection is
 * the count over the UNION of their levels — adding the tracks' own sizes would count a
 * shared level once per track. This is the same union `difficultyLevels` hands the feed
 * endpoint, availability rule included, so the figure shown is the pack that is served.
 * @param ids Track ids (order and duplicates do not matter)
 * @param levelCounts Words per CEFR level, as reported by the feed endpoint
 * @param catalogLevels Levels the catalog has words for
 * @returns The number of distinct words the selection admits (0 for no tracks)
 * @pure true
 */
export function countTrackWords(
  ids: Iterable<string>,
  levelCounts: Partial<Record<VocabularyLevel, number>>,
  catalogLevels: readonly VocabularyLevel[],
): number {
  const levels = difficultyLevels([...ids].join(","), catalogLevels);
  if (!levels) return 0;
  return levels.reduce((sum, level) => sum + (levelCounts[level] ?? 0), 0);
}
