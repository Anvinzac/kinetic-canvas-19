/**
 * Turning a caller into a countable-but-unidentifiable reporter key.
 *
 * The block rule needs to know whether two reports came from two readers. That is the ONLY
 * question it is allowed to answer, so this is what it stores: a one-way digest of the
 * address, salted per word.
 *
 * Why per word. A single global salt would give every word the same key for the same
 * reader, and the set of keys across words would then be a browsing history under a
 * pseudonym. Mixing the word id in means two reports by one reader on two words produce
 * unrelated keys: the only comparison that still works is the one the rule needs — same
 * reader, same word.
 *
 * What this is not. It is not anonymous in the strong sense: anyone holding the salt can
 * test a guessed address against a stored key. It is a counting aid, not a shield. The
 * address itself is never written, never logged, and never leaves this function.
 *
 * Exports: reporterDigest
 * Depends on: node:crypto
 */

import { createHash } from "node:crypto";

/**
 * Salt for the digest. Set WORD_REPORT_SALT in the deployment to make keys stable across
 * restarts and unguessable; without it the fallback is a constant, which still prevents
 * the address being read back but lets someone who knows this source test a guess.
 */
const SALT = process.env.WORD_REPORT_SALT ?? "chayla:word-report:v1";

/**
 * An opaque key for "this caller, on this word".
 * @param caller - the caller's address, or any stable key the edge gave us
 * @param wordId - the word being reported; part of the hash, so keys do not correlate
 * @returns 24 hex characters, or null when the caller could not be distinguished at all
 * @pure false (reads an environment variable)
 */
export function reporterDigest(caller: string, wordId: string): string | null {
  const trimmed = caller.trim();
  // "local" is the placeholder the endpoint uses when no forwarding header is present, so
  // every local caller would otherwise share one key and three reports from one machine
  // would block a word. Better to count nothing than to count wrongly.
  if (!trimmed || trimmed === "local") return null;
  return createHash("sha256").update(`${SALT}|${wordId}|${trimmed}`).digest("hex").slice(0, 24);
}
