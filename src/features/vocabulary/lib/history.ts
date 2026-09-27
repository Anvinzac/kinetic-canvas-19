/** On-device viewing history with sliding-window repeat caps. Exports: history helpers. Depends on: none (localStorage only). */
export const DAY_MS = 24 * 60 * 60 * 1000;
export const THREE_DAYS_MS = 3 * DAY_MS;
export const WEEK_MS = 7 * DAY_MS;
export const HISTORY_KEY = "wordcrawler:view-history:v1";

export type ViewHistory = Record<string, number[]>;

function isValidHistory(value: unknown): value is ViewHistory {
  if (typeof value !== "object" || value === null) return false;
  return Object.values(value as Record<string, unknown>).every(
    (item) => Array.isArray(item) && item.every((t) => typeof t === "number" && Number.isFinite(t)),
  );
}

/** Remove timestamps older than one week; drop empty words. @param history Raw map. @param now Reference time. @returns Pruned map (mutates input). */
export function pruneHistory(history: ViewHistory, now: number = Date.now()): ViewHistory {
  const cutoff = now - WEEK_MS;
  for (const [wordId, times] of Object.entries(history)) {
    const kept = times.filter((t) => t > cutoff && t <= now + 60_000);
    if (kept.length) history[wordId] = kept;
    else delete history[wordId];
  }
  return history;
}

/** Load history from localStorage; never throws. @returns Pruned map. */
export function loadHistory(now: number = Date.now()): ViewHistory {
  try {
    if (typeof localStorage === "undefined") return {};
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!isValidHistory(parsed)) return {};
    return pruneHistory(parsed, now);
  } catch {
    return {};
  }
}

/** Persist history; never throws. @param history Map to store. */
export function saveHistory(history: ViewHistory): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Quota or privacy mode — history simply stays in memory.
  }
}

/** Count views inside a sliding window. @param times Timestamps. @param now Reference. @param windowMs Window. @returns Count. */
export function countSince(times: number[], now: number, windowMs: number): number {
  const cutoff = now - windowMs;
  let count = 0;
  for (const t of times) if (t > cutoff && t <= now + 60_000) count++;
  return count;
}

/** Check repeat caps: <=1/day, <=2/3days, <=3/week. @param history Map. @param wordId Word id. @param now Reference. @returns True when the word may be shown. */
export function isWordAllowed(
  history: ViewHistory,
  wordId: string,
  now: number = Date.now(),
): boolean {
  const times = history[wordId];
  if (!times || !times.length) return true;
  if (countSince(times, now, DAY_MS) >= 1) return false;
  if (countSince(times, now, THREE_DAYS_MS) >= 2) return false;
  if (countSince(times, now, WEEK_MS) >= 3) return false;
  return true;
}

/** Earliest time the word becomes showable again. @param history Map. @param wordId Word id. @param now Reference. @returns Timestamp (now when already allowed). */
export function nextAvailableAt(
  history: ViewHistory,
  wordId: string,
  now: number = Date.now(),
): number {
  if (isWordAllowed(history, wordId, now)) return now;
  const times = [...(history[wordId] ?? [])].sort((a, b) => b - a);
  const blocked: number[] = [];
  const day = times.filter((t) => t > now - DAY_MS);
  if (day.length >= 1) blocked.push(Math.min(...day) + DAY_MS);
  const three = times.filter((t) => t > now - THREE_DAYS_MS);
  if (three.length >= 2) blocked.push(three.sort((a, b) => a - b)[three.length - 2] + THREE_DAYS_MS);
  const week = times.filter((t) => t > now - WEEK_MS);
  if (week.length >= 3) blocked.push(week.sort((a, b) => a - b)[week.length - 3] + WEEK_MS);
  return blocked.length ? Math.max(...blocked) : now;
}

/** Record one view, returning a new map. @param history Previous map. @param wordId Word id. @param now Reference. @returns New pruned map. */
export function recordView(
  history: ViewHistory,
  wordId: string,
  now: number = Date.now(),
): ViewHistory {
  const next: ViewHistory = { ...history, [wordId]: [...(history[wordId] ?? []), now] };
  return pruneHistory(next, now);
}

export type HistoryStats = {
  distinctToday: number;
  distinct3d: number;
  distinct7d: number;
  totalViews7d: number;
};

/** Summarize distinct words seen per window. @param history Map. @param now Reference. @returns Stats. */
export function historyStats(history: ViewHistory, now: number = Date.now()): HistoryStats {
  let distinctToday = 0;
  let distinct3d = 0;
  let distinct7d = 0;
  let totalViews7d = 0;
  for (const times of Object.values(history)) {
    if (countSince(times, now, DAY_MS) > 0) distinctToday++;
    if (countSince(times, now, THREE_DAYS_MS) > 0) distinct3d++;
    if (countSince(times, now, WEEK_MS) > 0) distinct7d++;
    totalViews7d += countSince(times, now, WEEK_MS);
  }
  return { distinctToday, distinct3d, distinct7d, totalViews7d };
}

/** Human countdown until a timestamp. @param target Future time. @param now Reference. @returns Short label like "5h 12m". */
export function formatCountdown(target: number, now: number = Date.now()): string {
  const ms = Math.max(0, target - now);
  const mins = Math.ceil(ms / 60_000);
  if (mins < 1) return "soon";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}
