/** Server-only bundled catalog and bounded permutation caches. Exports: catalog, readVocabularyPage. Depends on: compiled JSON, PRNG. */
import rawCatalog from "../data/catalog.json";
import type { Catalog } from "../lib/schema";
import { randomGenerator } from "../lib/random";
import type { FeedPage, FeedRequest } from "../types";

export const catalog = rawCatalog as Catalog;
export const MAX_POSITION = 1_000_000_000_000;
const pools = new Map<string, Uint32Array>();
const orders = new Map<string, Uint32Array>();

function remember(cache: Map<string, Uint32Array>, key: string, value: Uint32Array, cap: number) {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > cap) cache.delete(cache.keys().next().value!);
  return value;
}

function matchingPool(topic: string, level: string): Uint32Array {
  const key = `${topic}:${level}`;
  const existing = pools.get(key);
  if (existing) return remember(pools, key, existing, 16);
  const matches: number[] = [];
  catalog.words.forEach((word, index) => {
    if ((!topic || word.topic === topic) && (!level || word.level === level)) matches.push(index);
  });
  return remember(pools, key, Uint32Array.from(matches), 16);
}

function rawOrder(size: number, seed: string, cycle: number): Uint32Array {
  // With two words a fixed alternating order is the only way to avoid adjacent repeats.
  const orderCycle = size <= 2 ? 0 : cycle;
  const key = `${seed}:${size}:${orderCycle}`;
  const cached = orders.get(key);
  if (cached) return remember(orders, key, cached, 8);
  const order = Uint32Array.from({ length: size }, (_, index) => index);
  const random = randomGenerator(key);
  for (let index = size - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [order[index], order[other]] = [order[other], order[index]];
  }
  return remember(orders, key, order, 8);
}

function indexAt(size: number, seed: string, position: number): number {
  const cycle = Math.floor(position / size);
  let offset = position % size;
  const order = rawOrder(size, seed, cycle);
  // For n >= 3, swapping only the first two leaves the last element unchanged.
  // Thus the previous RAW last element is sufficient; no recursive cycle walk is needed.
  if (size >= 3 && cycle > 0 && offset < 2) {
    const previous = rawOrder(size, seed, cycle - 1);
    if (order[0] === previous[size - 1]) offset = 1 - offset;
  }
  return order[offset];
}

/** Read a deterministic page without writes or external services. @param input Validated cursor/filters. @returns Page plus catalog metadata. */
export function readVocabularyPage(input: FeedRequest): FeedPage {
  const { seed, position, topic, level, limit } = input;
  const pool = matchingPool(topic, level);
  const streamKey = `${catalog.revision}:${seed}:${topic}:${level}`;
  const entries = pool.length
    ? Array.from({ length: limit }, (_, offset) => {
        const absolute = position + offset;
        return {
          occurrenceId: `${streamKey}:${absolute}`,
          position: absolute,
          cycle: Math.floor(absolute / pool.length),
          word: catalog.words[pool[indexAt(pool.length, streamKey, absolute)]],
        };
      })
    : [];
  return {
    entries,
    seed,
    revision: catalog.revision,
    position,
    previousPosition: position > 0 && pool.length ? Math.max(0, position - limit) : null,
    nextPosition: pool.length && position + limit <= MAX_POSITION ? position + limit : null,
    total: catalog.count,
    matching: pool.length,
    name: catalog.name,
    topics: catalog.topics,
    levels: catalog.levels,
  };
}
