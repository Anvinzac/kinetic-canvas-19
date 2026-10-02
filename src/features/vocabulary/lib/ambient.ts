/**
 * Ambient background music player for the vocabulary feed.
 * Streams energetic tracks from free CDN sources (no self-hosting).
 * Two-tier source pool: DB tracks (primary) with hardcoded fallback.
 * Guarantees only one stream plays at a time.
 *
 * Exports: AmbientPlayer, AMBIENT_SOURCES, FALLBACK_SOURCES
 * Depends on: none (pure browser Audio API)
 */

type AudioSource = { url: string; name: string; bpm: number };

/**
 * Hardcoded fallback sources — always available even when the DB is empty
 * or all primary streams fail. Energetic/upbeat tracks from free CDNs.
 */
export const FALLBACK_SOURCES: AudioSource[] = [
  {
    url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Who%20Likes%20to%20Party.mp3",
    name: "Who Likes to Party",
    bpm: 128,
  },
  {
    url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Cool%20Rock.mp3",
    name: "Cool Rock",
    bpm: 120,
  },
  {
    url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Electro%20Cabello.mp3",
    name: "Electro Cabello",
    bpm: 126,
  },
  {
    url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Upbeat%20Forever.mp3",
    name: "Upbeat Forever",
    bpm: 130,
  },
  {
    url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Funk%20Game%20Loop.mp3",
    name: "Funk Game Loop",
    bpm: 124,
  },
  {
    url: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/RetroFuture%20Clean.mp3",
    name: "RetroFuture Clean",
    bpm: 132,
  },
  {
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    name: "SoundHelix Groove 1",
    bpm: 120,
  },
  {
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
    name: "SoundHelix Groove 6",
    bpm: 118,
  },
];

/** Active source pool — starts as fallback, replaced by DB tracks when loaded. */
export const AMBIENT_SOURCES: AudioSource[] = [...FALLBACK_SOURCES];

const STORAGE_KEY = "kinetic.vocab.ambient";
const AMBIENT_EVENT = "kinetic:vocab-ambient";

/** Read the persisted ambient-sound preference. */
export function getAmbientEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Persist and broadcast the ambient-sound preference. */
export function setAmbientEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (enabled) localStorage.setItem(STORAGE_KEY, "1");
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // quota / privacy mode — proceed anyway
  }
  window.dispatchEvent(new Event(AMBIENT_EVENT));
}

/** Event name dispatched when the ambient preference changes. */
export { AMBIENT_EVENT };

/**
 * Singleton audio player that streams background music from a two-tier pool:
 * primary (DB tracks) and fallback (hardcoded AMBIENT_SOURCES).
 * - Only ONE Audio element ever exists; previous stream is always flushed first.
 * - On error, exhausts the current pool then falls back to the other tier.
 * - Smooth fade-in on play, instant stop on pause.
 */
export class AmbientPlayer {
  private audio: HTMLAudioElement | null = null;
  private sourceIndex = -1;
  private consecutiveErrors = 0;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;
  private stopped = true;
  /** Whether we are currently drawing from the fallback pool. */
  private usingFallback = false;

  /** Target volume (0–1). Background music stays subtle. */
  volume = 0.18;

  /** The pool currently being played from. */
  private get pool(): AudioSource[] {
    return this.usingFallback ? FALLBACK_SOURCES : AMBIENT_SOURCES;
  }

  /** Currently playing source name, or null if stopped. */
  get currentSource(): string | null {
    if (this.stopped || this.sourceIndex < 0) return null;
    return this.pool[this.sourceIndex]?.name ?? null;
  }

  /** Start or resume playback. Picks a random source on first call. */
  play(): void {
    this.stopped = false;
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.addEventListener("ended", () => {
        if (!this.stopped) this.next();
      });
      this.audio.addEventListener("error", () => {
        if (!this.stopped) this.onError();
      });
    }
    if (this.sourceIndex < 0) {
      this.sourceIndex = Math.floor(Math.random() * this.pool.length);
    }
    this.loadAndPlay();
  }

  /** Stop playback completely. Guarantees silence — no stream left running. */
  stop(): void {
    this.stopped = true;
    this.clearFade();
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute("src");
      this.audio.load(); // flush pipeline, guarantees no buffered audio plays
    }
    this.sourceIndex = -1;
    this.consecutiveErrors = 0;
  }

  /** Advance to the next source in the current pool. */
  next(): void {
    const pool = this.pool;
    if (pool.length === 0) {
      this.switchPool();
      return;
    }
    this.sourceIndex = (this.sourceIndex + 1) % pool.length;
    this.consecutiveErrors = 0;
    this.loadAndPlay();
  }

  /** Replace the primary source pool (used when DB tracks are loaded). */
  setSources(sources: AudioSource[]): void {
    AMBIENT_SOURCES.length = 0;
    AMBIENT_SOURCES.push(...sources);
    // If we were using the primary pool, reset index if out of bounds.
    if (!this.usingFallback && this.sourceIndex >= AMBIENT_SOURCES.length) {
      this.sourceIndex = 0;
    }
  }

  private loadAndPlay(): void {
    if (!this.audio || this.stopped) return;
    const source = this.pool[this.sourceIndex];
    if (!source) return;
    // CRITICAL: flush any previous stream before starting a new one.
    // This guarantees never two streams play simultaneously.
    this.clearFade();
    this.audio.pause();
    this.audio.volume = 0;
    this.audio.src = source.url;
    const playPromise = this.audio.play();
    if (playPromise) {
      playPromise
        .then(() => {
          if (!this.stopped) this.fadeIn();
        })
        .catch(() => {
          // Autoplay blocked or source failed to decode.
          // Silently fail; the error event handler will trigger fallback.
        });
    }
  }

  private fadeIn(): void {
    if (!this.audio) return;
    const step = this.volume / 20;
    this.fadeTimer = setInterval(() => {
      if (!this.audio || this.stopped) {
        this.clearFade();
        return;
      }
      this.audio.volume = Math.min(this.volume, this.audio.volume + step);
      if (this.audio.volume >= this.volume) this.clearFade();
    }, 50);
  }

  private clearFade(): void {
    if (this.fadeTimer !== null) {
      clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }
  }

  private onError(): void {
    this.consecutiveErrors += 1;
    const pool = this.pool;
    // Exhausted current pool — switch to the other tier.
    if (this.consecutiveErrors >= pool.length) {
      this.switchPool();
      return;
    }
    // Skip to next source after a short delay.
    setTimeout(() => {
      if (!this.stopped) this.next();
    }, 300);
  }

  /** Switch between primary and fallback pools. */
  private switchPool(): void {
    this.usingFallback = !this.usingFallback;
    this.consecutiveErrors = 0;
    const pool = this.pool;
    if (pool.length === 0) {
      // Both pools empty — give up.
      this.stop();
      return;
    }
    this.sourceIndex = Math.floor(Math.random() * pool.length);
    this.loadAndPlay();
  }
}

/** Shared singleton — one player instance per page. */
let sharedPlayer: AmbientPlayer | null = null;

/** Get or create the shared ambient player singleton. */
export function getAmbientPlayer(): AmbientPlayer {
  if (!sharedPlayer) sharedPlayer = new AmbientPlayer();
  return sharedPlayer;
}

// ---------------------------------------------------------------------------
// Remote track fetching (Supabase-backed via admin server function)
// ---------------------------------------------------------------------------

let remoteTracks: Array<{ url: string; name: string; bpm: number }> | null = null;
let fetchInFlight: Promise<void> | null = null;

/**
 * Fetch tracks from the database. On success, replaces the player's source
 * pool with DB tracks (falling back to AMBIENT_SOURCES when empty).
 * Safe to call multiple times — only one request is in-flight at a time.
 */
export async function refreshRemoteTracks(): Promise<void> {
  if (remoteTracks) return; // already loaded
  if (fetchInFlight) return fetchInFlight;
  fetchInFlight = (async () => {
    try {
      const { listAmbientTracks } = await import("@/features/admin/api/ambient.functions");
      const tracks = await listAmbientTracks();
      if (tracks.length > 0) {
        remoteTracks = tracks.map((t) => ({ url: t.url, name: t.name, bpm: t.bpm }));
        getAmbientPlayer().setSources(remoteTracks);
      }
    } catch {
      // DB unavailable — silently use hardcoded fallback
    } finally {
      fetchInFlight = null;
    }
  })();
  return fetchInFlight;
}
