/**
 * Pure helpers for stable hash.
 *
 * Exports: getStableNumber
 * Depends on: none (leaf module)
 */
/**
 * Compute stablenumber.
 * @param value - value argument
 * @returns Computed value
 */
export function getStableNumber(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
