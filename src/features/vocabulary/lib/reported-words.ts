/**
 * Which words this device has already reported, kept on-device so the flag can show
 * "sent" and one reader does not file the same report over and over. It never
 * leaves the browser.
 *
 * Exports: hasReportedWord, rememberReportedWord
 * Depends on: localStorage
 */

const STORAGE_KEY = "kinetic.vocab.reported";
/** Plenty for a catalog of this size; the oldest ids fall off first. */
const LIMIT = 400;

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** Whether this device has already sent a report for the word. */
export function hasReportedWord(wordId: string): boolean {
  return read().includes(wordId);
}

/** Record that a report for the word was sent from this device. */
export function rememberReportedWord(wordId: string): void {
  if (typeof window === "undefined") return;
  try {
    const next = [wordId, ...read().filter((id) => id !== wordId)].slice(0, LIMIT);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode / quota: the report was still sent; only the reminder is lost.
  }
}
