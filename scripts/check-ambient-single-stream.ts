/**
 * Assert the ambient player can never produce two overlapping streams.
 *
 * The single-stream bug class lived OUTSIDE the player's own one-Audio guarantee: the
 * singleton was per-module-instance, so a hot-reload (fresh module scope) or a second
 * tab/window on the same origin each built their own Audio and both played. This script
 * locks in the four structural fixes with pure logic that needs no real audio:
 *   1. getAmbientPlayer() is identity-stable (the global registry survives re-import).
 *   2. shouldPlayAmbient — the enabled AND visible AND owner policy truth table.
 *   3. the cross-context ownership lease: claim / fresh / stale-takeover / demote / release.
 *   4. teardown: stop() flushes + pauses, forceReleaseForReload() detaches every
 *      listener and drops the element, and a cancelled error-retry cannot resurrect it.
 *
 * Usage: npm run check:ambient
 */
import {
  AMBIENT_OWNER_KEY,
  LEASE_TTL_MS,
  createAmbientOwnership,
  shouldPlayAmbient,
} from "../src/features/vocabulary/lib/ambientOwnership.ts";
import { getAmbientPlayer } from "../src/features/vocabulary/lib/ambient.ts";

const failures: string[] = [];
const rows: string[] = [];

function check(name: string, pass: boolean): void {
  rows.push(`${pass ? "PASS" : "FAIL"}  ${name}`);
  if (!pass) failures.push(name);
}

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function makeStorage(): StorageLike {
  const store = new Map<string, string>();
  return {
    getItem: (key) => (store.has(key) ? (store.get(key) as string) : null),
    setItem: (key, value) => void store.set(key, value),
    removeItem: (key) => void store.delete(key),
  };
}

// A minimal HTMLAudioElement stand-in, recording what the player attaches, detaches,
// and flushes so the teardown assertions are non-vacuous.
class FakeAudio {
  src: string | null = "unset";
  paused = true;
  volume = 0;
  loaded = 0;
  added: string[] = [];
  removed: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
  addEventListener(type: string, _cb: () => void): void {
    this.added.push(type);
  }
  removeEventListener(type: string, _cb: () => void): void {
    this.removed.push(type);
  }
  play(): Promise<void> {
    this.paused = false;
    return Promise.resolve();
  }
  pause(): void {
    this.paused = true;
  }
  load(): void {
    this.loaded += 1;
  }
  removeAttribute(name: string): void {
    if (name === "src") this.src = null;
  }
}

async function main(): Promise<void> {
  // --- 1. Global registry: the singleton survives a re-import / HMR ---
  const p1 = getAmbientPlayer();
  const p2 = getAmbientPlayer();
  check("getAmbientPlayer() returns the identical instance (global registry)", p1 === p2);

  // --- 2. Policy truth table: sound only when enabled AND visible AND owner ---
  check(
    "policy: enabled+visible+owner → play",
    shouldPlayAmbient({ enabled: true, visible: true, owner: true }),
  );
  check(
    "policy: disabled → silent",
    !shouldPlayAmbient({ enabled: false, visible: true, owner: true }),
  );
  check(
    "policy: background tab → silent",
    !shouldPlayAmbient({ enabled: true, visible: false, owner: true }),
  );
  check(
    "policy: not owner → silent",
    !shouldPlayAmbient({ enabled: true, visible: true, owner: false }),
  );

  // --- 3. Cross-context ownership lease ---
  const shared = makeStorage();
  let clock = 1_000;
  const now = () => clock;
  const tabA = createAmbientOwnership({ storage: shared, now, newTabId: () => "tabA" });
  const tabB = createAmbientOwnership({ storage: shared, now, newTabId: () => "tabB" });

  check("lease: A claims an empty lease", tabA.tryClaim() === true);
  check("lease: B cannot steal A's fresh lease", tabB.tryClaim() === false);
  check("lease: only A owns it", tabA.isOwner() && !tabB.isOwner());
  check("lease: A renews its own lease", tabA.renew() === true);
  check("lease: A's key names tabA", (shared.getItem(AMBIENT_OWNER_KEY) ?? "").includes("tabA"));

  clock += LEASE_TTL_MS + 1; // A's lease goes stale (e.g. A was hidden / closed)
  check("lease: B claims a stale lease", tabB.tryClaim() === true);
  check("lease: A is demoted once B owns", tabA.renew() === false);
  check("lease: A cannot steal B's fresh lease back", tabA.tryClaim() === false);

  tabB.release();
  check("lease: release clears the key", shared.getItem(AMBIENT_OWNER_KEY) === null);
  check("lease: A claims again after B releases", tabA.tryClaim() === true);
  // release() must never clobber someone else's lease.
  tabA.release();
  tabB.tryClaim(); // B now owns
  tabA.release(); // A releasing must not remove B's lease
  check(
    "lease: a non-owner release leaves the owner intact",
    (shared.getItem(AMBIENT_OWNER_KEY) ?? "").includes("tabB"),
  );

  // --- 4. Teardown: no orphan can keep playing ---
  (globalThis as unknown as { Audio: unknown }).Audio = FakeAudio;
  const player = getAmbientPlayer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const internals = player as any;

  player.play();
  check("play() selects an audible source", player.currentSource !== null);

  const element: FakeAudio = internals.audio;
  check(
    "Audio element gets its media listeners attached",
    element.added.includes("timeupdate") &&
      element.added.includes("ended") &&
      element.added.includes("error"),
  );

  player.stop();
  check("stop() pauses the element", element.paused === true);
  check(
    "stop() flushes src via removeAttribute (never src='')",
    element.src === null && element.loaded > 0,
  );
  check("stop() reports silent", player.currentSource === null);

  player.forceReleaseForReload();
  check(
    "forceReleaseForReload detaches every listener",
    element.removed.includes("timeupdate") &&
      element.removed.includes("ended") &&
      element.removed.includes("error"),
  );
  check("forceReleaseForReload drops the element reference", internals.audio === null);
  check("released player reports silent", player.currentSource === null);

  // A cancelled error-retry must not resurrect playback (the historical stop bug).
  player.play();
  if (typeof internals.errorHandler === "function") internals.errorHandler(); // schedules a 300ms retry
  if (internals.retryTimer !== null) clearTimeout(internals.retryTimer);
  player.stop();
  await new Promise((resolve) => setTimeout(resolve, 360));
  check("a cancelled/stopped error-retry cannot restart playback", player.currentSource === null);
  player.forceReleaseForReload();
}

main()
  .then(() => {
    console.log(rows.join("\n"));
    if (failures.length) {
      console.error(
        `\n${failures.length} ambient single-stream failure(s):\n${failures.map((f) => `  - ${f}`).join("\n")}`,
      );
      process.exitCode = 1;
    } else {
      console.log(`\n${rows.length} ambient single-stream assertions passed.`);
    }
  })
  .catch((error) => {
    console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exitCode = 1;
  });
