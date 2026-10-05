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
 *          difficultyLevels, formatLevelBand
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
};

/** Sentinel for "no track chosen" — the endpoint accepts it alongside a track id. */
export const DIFFICULTY_ALL = "";

/** The ten tracks, in the order the dropdown lists them. */
export const DIFFICULTY_TRACKS: readonly DifficultyTrack[] = [
  {
    id: "vo-long",
    label: "vỡ lòng",
    hint: "Mới bắt đầu, toàn từ rất quen",
    emoji: "🐣",
    levels: ["A1", "A2"],
  },
  {
    id: "co-ban",
    label: "cơ bản",
    hint: "Vốn từ nền tảng hằng ngày",
    emoji: "🌱",
    levels: ["A2"],
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
 * Resolve a track id to the CEFR levels it admits.
 * @param difficulty Track id, or the empty sentinel
 * @returns The level band, or null when no track is chosen
 * @pure true
 */
/**
 * Resolve a `difficulty` value into the CEFR levels it admits. A difficulty is now
 * a comma-joined list of track ids (multi-select), so the admitted band is the UNION
 * of every chosen track's levels, ordered by the canonical CEFR sequence.
 * @param difficulty Comma-joined track ids, or the empty sentinel for "all"
 * @returns The union band, or null when no track is chosen
 * @pure true
 */
export function difficultyLevels(difficulty: string): VocabularyLevel[] | null {
  const ids = difficulty
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (!ids.length) return null;
  const union = new Set<VocabularyLevel>();
  for (const id of ids) {
    const track = DIFFICULTY_TRACKS.find((entry) => entry.id === id);
    if (track) for (const level of track.levels) union.add(level);
  }
  if (!union.size) return null;
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
