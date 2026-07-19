/**
 * Pure helpers for size.
 *
 * Exports: suggestSize
 * Depends on: none (leaf module)
 */
/**
 * suggestSize helper
 * @param text - text argument
 * @param current - current argument
 * @returns Computed value
 */
export function suggestSize(text: string, current: number): number {
  const clean = text.trim();
  if (!clean) return current;
  if (clean.length > 150) return Math.min(current, 72);
  if (clean.length > 90) return Math.min(current, 84);
  if (clean.length > 48) return Math.min(current, 96);
  return current;
}
