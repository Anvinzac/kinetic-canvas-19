/**
 * The reader's chosen difficulty, remembered on this device.
 *
 * Its PRESENCE doubles as the "has been here before" mark: the first-load level picker is
 * shown exactly when nothing is stored, and whatever it stores — including the empty
 * string, for "every level" — is what the feed opens on next time.
 *
 * Exports: DIFFICULTY_CHOICE_KEY, readDifficultyChoice, writeDifficultyChoice
 * Depends on: ./difficulty (track ids, for validation)
 */

import { DIFFICULTY_IDS } from "./difficulty";

export const DIFFICULTY_CHOICE_KEY = "kinetic.vocab.difficulty";

/**
 * Read the stored choice.
 * @returns Comma-joined track ids ("" = every level), or null when nothing was ever chosen
 *   or storage is unavailable. Ids the app no longer knows are dropped rather than trusted.
 */
export function readDifficultyChoice(): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(DIFFICULTY_CHOICE_KEY);
    if (raw === null) return null;
    return raw
      .split(",")
      .map((id) => id.trim())
      .filter((id) => DIFFICULTY_IDS.includes(id))
      .join(",");
  } catch {
    return null;
  }
}

/** Remember a choice; never throws. @param difficulty Comma-joined track ids, "" for all. */
export function writeDifficultyChoice(difficulty: string): void {
  try {
    if (typeof localStorage !== "undefined")
      localStorage.setItem(DIFFICULTY_CHOICE_KEY, difficulty);
  } catch {
    // Quota or privacy mode — the picker simply shows again next visit.
  }
}
