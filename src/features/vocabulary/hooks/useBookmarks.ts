/**
 * React binding for this device's bookmarked words. Reads the local reaction
 * store, keeps it in state, and re-syncs when another tab writes to it.
 *
 * Exports: useBookmarks
 * Depends on: React, ../lib/reactions, ../lib/saved-words
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { REACTIONS_EVENT, REACTIONS_KEY, flipReaction } from "../lib/reactions";
import { getSavedWords, type SavedWord } from "../lib/saved-words";

/**
 * Bookmark list bound to localStorage.
 * @returns Saved words plus helpers to un-save one and to re-read the store.
 */
export function useBookmarks() {
  const [saved, setSaved] = useState<SavedWord[]>(() => getSavedWords());

  const refresh = useCallback(() => setSaved(getSavedWords()), []);

  // Keep the latest refresh callback out of the listener deps so a re-render
  // cannot tear down and re-add the storage listener every time.
  const stable = useRef(refresh);
  useEffect(() => {
    stable.current = refresh;
  }, [refresh]);

  // Another tab flipping a bookmark must show up here too, and so must a write
  // from this tab (the native storage event skips the tab that wrote it).
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === REACTIONS_KEY) stable.current();
    };
    const refresh = () => stable.current();
    window.addEventListener("storage", onStorage);
    window.addEventListener(REACTIONS_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(REACTIONS_EVENT, refresh);
    };
  }, []);

  /** Remove one word from this device's saved list. */
  const unbookmark = useCallback(
    (wordId: string) => {
      if (!wordId) return;
      // flipReaction toggles; on a bookmarked word it always un-saves it.
      flipReaction(wordId, "bookmark");
      refresh();
    },
    [refresh],
  );

  return { saved, unbookmark, refresh };
}
