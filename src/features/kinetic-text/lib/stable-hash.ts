/**
 * @responsibility Stable FNV-1a hash of a string for deterministic layout/emphasis picks.
 * @inputs Arbitrary string seed
 * @outputs Unsigned 32-bit integer
 * @pure true
 */
export function getStableNumber(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
