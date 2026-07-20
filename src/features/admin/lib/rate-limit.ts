/**
 * Simple in-memory token bucket for admin telemetry HTTP routes.
 *
 * Exports: allowTelemetryRequest
 * Depends on: none
 */

type Bucket = { tokens: number; updatedAt: number };

const buckets = new Map<string, Bucket>();
const CAPACITY = 120;
const REFILL_PER_SEC = 2;

/**
 * Allow or deny a telemetry request for a given key (IP or user id).
 * @param key - rate-limit bucket key
 * @returns true when allowed
 */
export function allowTelemetryRequest(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: CAPACITY, updatedAt: now };
  const elapsed = (now - bucket.updatedAt) / 1000;
  bucket.tokens = Math.min(CAPACITY, bucket.tokens + elapsed * REFILL_PER_SEC);
  bucket.updatedAt = now;
  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    return false;
  }
  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return true;
}
