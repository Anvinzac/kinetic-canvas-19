/**
 * React hook managing the ambient background music toggle and playback.
 * Persists the on/off preference to localStorage (same-tab reactive via custom event).
 *
 * Exports: useAmbientSound
 * Depends on: ../lib/ambient
 */

import { useCallback, useEffect, useState } from "react";
import {
  AMBIENT_EVENT,
  getAmbientEnabled,
  getAmbientPlayer,
  refreshRemoteTracks,
  setAmbientEnabled,
} from "../lib/ambient";

/**
 * Toggle and control ambient background music.
 * Returns the current enabled state and a toggle function.
 * Playback starts/stops automatically based on the enabled state.
 */
export function useAmbientSound(): {
  enabled: boolean;
  toggle: () => void;
  nextTrack: () => void;
  trackName: string | null;
} {
  const [enabled, setEnabled] = useState(getAmbientEnabled);
  const [trackName, setTrackName] = useState<string | null>(null);

  const sync = useCallback(() => {
    setEnabled(getAmbientEnabled());
  }, []);

  // Listen for same-tab custom events and cross-tab storage events.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === "kinetic.vocab.ambient") sync();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(AMBIENT_EVENT, sync);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(AMBIENT_EVENT, sync);
    };
  }, [sync]);

  // Start or stop playback when the enabled state changes.
  useEffect(() => {
    const player = getAmbientPlayer();
    if (enabled) {
      refreshRemoteTracks(); // load DB tracks in background
      player.play();
      setTrackName(player.currentSource);
    } else {
      player.stop();
      setTrackName(null);
    }
  }, [enabled]);

  // Update track name when the source rotates.
  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => {
      const player = getAmbientPlayer();
      setTrackName(player.currentSource);
    }, 3000);
    return () => clearInterval(interval);
  }, [enabled]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      getAmbientPlayer().stop();
    };
  }, []);

  const toggle = useCallback(() => {
    const next = !getAmbientEnabled();
    setAmbientEnabled(next);
  }, []);

  const nextTrack = useCallback(() => {
    if (!getAmbientEnabled()) return;
    getAmbientPlayer().next();
  }, []);

  return { enabled, toggle, nextTrack, trackName };
}
