/** Deterministic PRNG shared by ordering and appearance. Exports: hash, randomGenerator. Depends on: none. */

/** Hash text into an unsigned 32-bit seed. @param text Stable seed material. @returns Numeric seed. */
export function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index++)
    value = Math.imul(value ^ text.charCodeAt(index), 16777619);
  return value >>> 0;
}

/** Build a reproducible Mulberry32 generator (not for security). @param seed Stable text. @returns Uniform unit-range generator. */
export function randomGenerator(seed: string): () => number {
  let state = hash(seed);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
