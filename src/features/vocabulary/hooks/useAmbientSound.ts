/**
 * React hook managing the ambient background music toggle and playback.
 * Persists the on/off preference to localStorage (same-tab reactive via a custom event,
 * cross-tab reactive via the native storage event).
 *
 * Playback is gated by a three-part policy: enabled (the user turned music on) AND
 * visible (this tab/window is foreground) AND owner (this context holds the cross-
 * context audible lease from ../lib/ambientOwnership). Reflected `enabled` state drives
 * the toolbar icon and updates freely from events, but only a context satisfying ALL
 * three conditions actually makes sound — so two tabs/windows/previews sharing the
 * origin can never play over each other.
 *
 * Exports: useAmbientSound
 * Depends on: ../lib/ambient, ../lib/ambientOwnership
 */

import { useCallback, useEffect, useState } from "react";
import {
  AMBIENT_EVENT,
  getAmbientEnabled,
  getAmbientPlayer,
  refreshRemoteTracks,
  setAmbientEnabled,
} from "../lib/ambient";
import { AMBIENT_OWNER_KEY, getAmbientOwnership, shouldPlayAmbient } from "../lib/ambientOwnership";

/** The localStorage key the enabled/disabled preference lives under (mirrors ambient.ts). */
const PREF_KEY = "kinetic.vocab.ambient";

/**
 * Toggle and control ambient background music.
 * Returns the current enabled state, a toggle, a track-skip helper, and the playing
 * track's name (null while silent).
 */
export function useAmbientSound(): {
  enabled: boolean;
  toggle: () => void;
  nextTrack: () => void;
  trackName: string | null;
} {
  const [enabled, setEnabled] = useState(getAmbientEnabled);
  const [trackName, setTrackName] = useState<string | null>(null);

  // Reconcile real sound with the policy. Idempotent and cheap: it never re-plays a
  // track that is already audible, so frequent re-evaluations (visibility, storage,
  // heartbeats) cannot restart the music mid-track.
  const reconcile = useCallback(() => {
    const player = getAmbientPlayer();
    const ownership = getAmbientOwnership();
    const isEnabled = getAmbientEnabled();
    const visible = typeof document !== "undefined" && document.visibilityState === "visible";
    // Only attempt the (read-modify-write) claim when we would otherwise want sound.
    const owner = isEnabled && visible ? ownership.tryClaim() : false;

    if (shouldPlayAmbient({ enabled: isEnabled, visible, owner })) {
      refreshRemoteTracks(); // load DB tracks in the background (no-op once loaded)
      if (!player.currentSource) player.play();
      setTrackName(player.currentSource);
    } else {
      player.stop();
      ownership.release();
      setTrackName(null);
    }
  }, []);

  // React to the same-tab custom event, cross-tab preference changes, cross-context
  // ownership changes, and this tab's own visibility flips.
  useEffect(() => {
    const onPrefChange = () => {
      setEnabled(getAmbientEnabled());
      reconcile();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === PREF_KEY) onPrefChange();
      // Another context claimed or released the audible lease — re-decide immediately.
      else if (event.key === AMBIENT_OWNER_KEY) reconcile();
    };
    const onVisibility = () => reconcile();

    window.addEventListener("storage", onStorage);
    window.addEventListener(AMBIENT_EVENT, onPrefChange);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(AMBIENT_EVENT, onPrefChange);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reconcile]);

  // Reconcile whenever our reflected enabled state flips (e.g. a same-tab toggle).
  useEffect(() => {
    reconcile();
  }, [enabled, reconcile]);

  // Heartbeat: while enabled and visible, keep the lease fresh and the shown track name
  // in sync. A failed renew means another context took over (we were demoted) → go
  // silent; a missing lease while we still want sound means it is free → take it.
  useEffect(() => {
    if (!enabled) return;
    const ownership = getAmbientOwnership();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (!ownership.isOwner()) {
        reconcile();
        return;
      }
      if (!ownership.renew()) {
        getAmbientPlayer().stop();
        setTrackName(null);
        return;
      }
      setTrackName(getAmbientPlayer().currentSource);
    }, ownership.LEASE_HEARTBEAT_MS);
    return () => clearInterval(interval);
  }, [enabled, reconcile]);

  // Tear the player down and relinquish the lease when this view unmounts, so a
  // navigating reader never leaves sound playing with no owner to control it.
  useEffect(() => {
    return () => {
      getAmbientPlayer().stop();
      getAmbientOwnership().release();
    };
  }, []);

  const toggle = useCallback(() => {
    setAmbientEnabled(!getAmbientEnabled());
  }, []);

  const nextTrack = useCallback(() => {
    if (!getAmbientEnabled()) return;
    // A requested change fades the old track out and the new one in, and always lands
    // on a different track; the hard-cutting next() is for tracks that ended or failed.
    getAmbientPlayer().changeTrack();
  }, []);

  return { enabled, toggle, nextTrack, trackName };
}
