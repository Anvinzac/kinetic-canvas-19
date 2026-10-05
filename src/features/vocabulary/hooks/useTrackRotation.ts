/**
 * Rotate the ambient music as the reader moves through the stream: every
 * WORDS_PER_TRACK words the player hands over to a different track, and the
 * hand-over is placed on a word boundary — the old track fades out as its last
 * word finishes, the new one starts as the next word begins.
 *
 * The count belongs to the track, not to the session. If the track changes for any
 * other reason — it ran out, the reader shuffled, the music was switched off and
 * on — the count starts again, so a fresh track always gets its full run of words.
 *
 * Exports: useTrackRotation
 * Depends on: React, ../lib/ambient
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { FADE_OUT_MS, WORDS_PER_TRACK, getAmbientEnabled, getAmbientPlayer } from "../lib/ambient";

/** Finish the fade just before the word does, not exactly on it. */
const FADE_LEAD_MS = 150;

/**
 * Count words against the current track and change track when its run is over.
 * @returns `wordStarted` — call once each time a new word comes on screen.
 *   `wordEnding` — call when the on-screen word enters its final page, with the
 *   milliseconds left before the stream moves on (0 when the reader pages by hand).
 */
export function useTrackRotation(): {
  wordStarted: () => void;
  wordEnding: (remainingMs: number) => void;
} {
  const run = useRef({ words: 0, serial: -1 });
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelFade = useCallback(() => {
    if (fadeTimer.current !== null) clearTimeout(fadeTimer.current);
    fadeTimer.current = null;
  }, []);
  useEffect(() => cancelFade, [cancelFade]);

  const wordStarted = useCallback(() => {
    cancelFade();
    if (!getAmbientEnabled()) {
      run.current.words = 0;
      return;
    }
    const player = getAmbientPlayer();
    // The old track already bowed out (its run was over, or it simply ran out of
    // music) and the player has been waiting for exactly this moment.
    if (player.awaitingWord) {
      const serial = player.changeTrack();
      if (serial !== null) run.current = { words: 1, serial };
      return;
    }
    if (player.trackSerial !== run.current.serial) {
      run.current = { words: 0, serial: player.trackSerial };
    }
    run.current.words += 1;
    if (run.current.words <= WORDS_PER_TRACK) return;
    // The run is over but nothing prepared the hand-over (the reader flicked past the
    // previous word before it finished). Change now; this word is the new track's
    // first. A refused change leaves the count over the limit, so the next word retries.
    const serial = player.changeTrack();
    if (serial !== null) run.current = { words: 1, serial };
  }, [cancelFade]);

  const wordEnding = useCallback(
    (remainingMs: number) => {
      cancelFade();
      if (!getAmbientEnabled()) return;
      const player = getAmbientPlayer();
      // Only the last word of a track's run prepares a hand-over, and only when
      // there is another track to hand over to.
      if (player.trackSerial !== run.current.serial) return;
      if (run.current.words < WORDS_PER_TRACK || !player.canChange) return;
      const wait = Math.max(0, remainingMs - FADE_OUT_MS - FADE_LEAD_MS);
      fadeTimer.current = setTimeout(() => {
        fadeTimer.current = null;
        getAmbientPlayer().fadeOutAndHold();
      }, wait);
    },
    [cancelFade],
  );

  return useMemo(() => ({ wordStarted, wordEnding }), [wordStarted, wordEnding]);
}
