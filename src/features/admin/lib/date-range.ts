/**
 * Date-range helpers for admin search params (UTC day keys).
 *
 * Exports: utcToday, daysAgo, parseAdminRange, AdminRangePreset
 * Depends on: none
 */

export type AdminRangePreset = "24h" | "7d" | "30d" | "custom";

/**
 * UTC today as YYYY-MM-DD.
 * @returns date string
 */
export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * UTC date N days before today.
 * @param n - days back
 * @returns YYYY-MM-DD
 */
export function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Resolve from/to for a preset (custom uses provided bounds).
 * @param preset - range preset
 * @param from - optional custom from
 * @param to - optional custom to
 * @returns from/to pair
 */
export function parseAdminRange(
  preset: AdminRangePreset,
  from?: string,
  to?: string,
): { from: string; to: string } {
  const toDay = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : utcToday();
  if (preset === "24h" || preset === "7d") {
    return { from: daysAgo(preset === "24h" ? 1 : 7), to: toDay };
  }
  if (preset === "30d") return { from: daysAgo(30), to: toDay };
  return {
    from: from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : daysAgo(7),
    to: toDay,
  };
}
