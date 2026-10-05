/**
 * Cross-context ownership lease for the ambient player.
 *
 * Sound is a device-wide resource, so exactly ONE browsing context (tab, window, or
 * iframe) on the origin may audibly play the feed's background music at a time. This
 * module arbitrates that with a `localStorage` lease keyed by a per-context id, and
 * exposes the pure policy that decides when a context is allowed to make sound.
 *
 * The single-stream invariant that lives INSIDE `AmbientPlayer` (one `Audio` per
 * instance) is not enough: two contexts each build their own instance, and each would
 * play. This lease is what makes the guarantee hold ACROSS contexts.
 *
 * Exports: AMBIENT_OWNER_KEY, LEASE_TTL_MS, LEASE_HEARTBEAT_MS, shouldPlayAmbient,
 *          createAmbientOwnership, getAmbientOwnership, AmbientOwnership
 * Depends on: none (browser storage only; SSR-safe, injectable for tests)
 */

/** `localStorage` key holding the current audible-context lease. */
export const AMBIENT_OWNER_KEY = "kinetic.vocab.ambient.owner";

/** A lease is takeover-able once it has not been renewed for this long. */
export const LEASE_TTL_MS = 6000;
/** The owner refreshes its lease on this cadence, well inside the TTL. */
export const LEASE_HEARTBEAT_MS = 2000;

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

type OwnerRecord = { tabId: string; ts: number };

/**
 * The one rule for whether a context may make sound. Centralised so the hook, and the
 * regression script, all agree on a single definition.
 * @param state enabled = the user turned music on; visible = this tab is foreground;
 *   owner = this context currently holds the audible lease.
 * @pure true
 */
export function shouldPlayAmbient(state: {
  enabled: boolean;
  visible: boolean;
  owner: boolean;
}): boolean {
  return state.enabled && state.visible && state.owner;
}

/**
 * Build an ownership lease over injected dependencies, so it can run against a real
 * browser `localStorage` in the app and against an in-memory shim in tests.
 * @pure the returned object mutates only the injected storage
 */
export function createAmbientOwnership(deps: {
  storage: StorageLike | null;
  now: () => number;
  newTabId: () => string;
}) {
  const tabId = deps.newTabId();

  function read(): OwnerRecord | null {
    if (!deps.storage) return null;
    try {
      const raw = deps.storage.getItem(AMBIENT_OWNER_KEY);
      return raw ? (JSON.parse(raw) as OwnerRecord) : null;
    } catch {
      return null;
    }
  }

  /** True when THIS context currently holds the lease. */
  function isOwner(): boolean {
    const record = read();
    return !!record && record.tabId === tabId;
  }

  /** True when a DIFFERENT context holds a lease that has not yet gone stale. */
  function otherHoldsFresh(): boolean {
    const record = read();
    return !!record && record.tabId !== tabId && deps.now() - record.ts < LEASE_TTL_MS;
  }

  /**
   * Take (or keep) the audible lease. Returns whether this context may make sound.
   * A fresh lease held by someone else is respected (never stolen mid-playback); a
   * stale or absent lease is claimed. With no storage (SSR / privacy mode) we assume a
   * single context and allow playback.
   */
  function tryClaim(): boolean {
    if (!deps.storage) return true;
    if (otherHoldsFresh()) return false;
    try {
      deps.storage.setItem(AMBIENT_OWNER_KEY, JSON.stringify({ tabId, ts: deps.now() }));
    } catch {
      // Storage write failed (quota / privacy); treat as sole context and allow.
      return true;
    }
    return true;
  }

  /**
   * Renew the lease. Returns false when this context has been DEMOTED (the key no
   * longer names it), which is the caller's signal to go silent.
   */
  function renew(): boolean {
    const record = read();
    if (!record || record.tabId !== tabId) return false;
    try {
      deps.storage?.setItem(AMBIENT_OWNER_KEY, JSON.stringify({ tabId, ts: deps.now() }));
    } catch {
      // Ignore: a failed renew will simply let the lease go stale and be re-claimed.
    }
    return true;
  }

  /** Release the lease, but only if we hold it (never clear another context's lease). */
  function release(): void {
    const record = read();
    if (record && record.tabId === tabId) {
      try {
        deps.storage?.removeItem(AMBIENT_OWNER_KEY);
      } catch {
        // Ignore.
      }
    }
  }

  return {
    tabId,
    isOwner,
    tryClaim,
    renew,
    release,
    LEASE_TTL_MS,
    LEASE_HEARTBEAT_MS,
  };
}

export type AmbientOwnership = ReturnType<typeof createAmbientOwnership>;

// The default browser instance, wired to the real globals and memoised so every caller
// in this context shares one lease. SSR-safe: with no `localStorage`, `tryClaim` keeps
// returning true and playback proceeds as a single-context assumption.
let defaultOwnership: AmbientOwnership | null = null;

/** Get (or create) this context's shared ownership lease. */
export function getAmbientOwnership(): AmbientOwnership {
  if (defaultOwnership) return defaultOwnership;
  const storage: StorageLike | null =
    typeof globalThis !== "undefined" && "localStorage" in globalThis ? localStorage : null;
  defaultOwnership = createAmbientOwnership({
    storage,
    now: () => Date.now(),
    newTabId: () =>
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `tab-${Math.random().toString(36).slice(2)}`,
  });
  return defaultOwnership;
}
