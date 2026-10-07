/**
 * Anonymous session tracking for visitor-level telemetry.
 *
 * Generates a stable session ID per browser (localStorage) so we can correlate
 * visitor behavior with error events without requiring authentication. The ID
 * is sent as `entity_id` on telemetry events with `actor_user_id: null`,
 * letting the admin dashboard answer "which sessions broke and why".
 *
 * Exports: getSessionId, resetSessionId
 * Depends: none (browser localStorage only)
 */

const STORAGE_KEY = "kinetic.session.id";

/** Return the current session ID, creating one if absent. */
export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

/** Clear the current session ID (e.g. on explicit logout or for testing). */
export function resetSessionId(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
