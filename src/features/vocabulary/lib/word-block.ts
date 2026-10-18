/**
 * When enough separate readers report the same word, hide it until an admin has looked.
 *
 * The rule is deliberately about SEPARATE readers, not about how many reports arrived: one
 * person tapping the same word eight times is one opinion, and the block is meant to catch
 * the case where strangers independently see the same thing wrong. A report therefore
 * carries an opaque reporter key (see reporter-digest.server.ts — it is a salted digest,
 * never an address), and only distinct keys count.
 *
 * The block is PROVISIONAL, which is the whole point: it takes the word out of the feed
 * while it waits for a human, and the moment an admin resolves those reports the word comes
 * back. Nothing here decides that a word is wrong — only that enough people said so for it
 * to be worth not showing until someone checks.
 *
 * This module is pure so the rule can be asserted without a database:
 * scripts/check-word-block.ts drives it directly.
 *
 * Exports: BLOCK_AFTER_DISTINCT_REPORTERS, WordReportSignal, getBlockedWordIds,
 *   getBlockDigest, countDistinctReporters
 * Depends on: none (leaf module)
 */

/**
 * How many separate readers must report one word before it is hidden.
 *
 * Three is a judgement, not a law: one reader can be mistaken, two can be the same person
 * on two networks, three strangers agreeing is a signal worth acting on. Raising it makes
 * the feed more forgiving of a bad entry; lowering it makes a small number of readers able
 * to take a word out of circulation until an admin returns.
 */
export const BLOCK_AFTER_DISTINCT_REPORTERS = 3;

/** The only part of a stored report this rule looks at. */
export type WordReportSignal = {
  wordId: string;
  /**
   * Opaque per-word reporter key, or null for a report filed before reporter keys existed
   * (or where the caller could not be distinguished at all). A null NEVER counts: it cannot
   * be shown to be a different reader from any other null, and counting it would let a
   * single source cross the threshold alone.
   */
  reporter: string | null;
  /** Only an unresolved report counts; resolving is the admin verification that lifts it. */
  status: "new" | "resolved";
};

/**
 * How many distinct readers have an open report against this word.
 * @param reports - every stored signal, any word, any status
 * @param wordId - the word to count for
 * @returns The number of distinct, non-null reporter keys among its open reports
 * @pure true
 */
export function countDistinctReporters(
  reports: readonly WordReportSignal[],
  wordId: string,
): number {
  const seen = new Set<string>();
  for (const report of reports) {
    if (report.wordId !== wordId || report.status !== "new" || !report.reporter) continue;
    seen.add(report.reporter);
  }
  return seen.size;
}

/**
 * Every word currently held back from the feed.
 * @param reports - every stored signal, any word, any status
 * @returns Word ids with at least BLOCK_AFTER_DISTINCT_REPORTERS distinct open reporters
 * @pure true
 */
export function getBlockedWordIds(reports: readonly WordReportSignal[]): Set<string> {
  const byWord = new Map<string, Set<string>>();
  for (const report of reports) {
    if (report.status !== "new" || !report.reporter) continue;
    let reporters = byWord.get(report.wordId);
    if (!reporters) byWord.set(report.wordId, (reporters = new Set()));
    reporters.add(report.reporter);
  }
  const blocked = new Set<string>();
  for (const [wordId, reporters] of byWord) {
    if (reporters.size >= BLOCK_AFTER_DISTINCT_REPORTERS) blocked.add(wordId);
  }
  return blocked;
}

/**
 * A short, order-independent digest of a blocklist.
 *
 * The served catalog's revision is built from this. A cursor is only valid against the
 * revision that issued it, so when the blocklist changes the revision must change with it —
 * otherwise a reader would page on through a word pool that is no longer the one their
 * cursor was cut from.
 * @param blocked - the blocked word ids, in any order
 * @returns 12 hex characters; "" for an empty blocklist, so an unblocked catalog keeps its
 *   own revision untouched
 * @pure true
 */
export function getBlockDigest(blocked: ReadonlySet<string>): string {
  if (blocked.size === 0) return "";
  const joined = [...blocked].sort().join(",");
  let digest = "";
  for (let round = 0; digest.length < 12; round += 1) {
    let hash = 0x811c9dc5;
    const stream = `${round}:${joined}`;
    for (let index = 0; index < stream.length; index += 1) {
      hash ^= stream.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    digest += hash.toString(16).padStart(8, "0");
  }
  return digest.slice(0, 12);
}
