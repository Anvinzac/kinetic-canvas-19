/**
 * React binding for this device's two saved-word lists: the words it bookmarked
 * ("Đã lưu") and the words it hearted ("Yêu thích"). Both are read from the same
 * localStorage reaction store, so ONE listener keeps both tabs and both counts in
 * sync instead of registering a duplicate per tab.
 *
 * This module reaches the bundled catalog through ../lib/saved-words, so it belongs to
 * the saved page only. The toolbar badge count deliberately stays in ./useSavedCount,
 * which touches nothing but the reaction leaf.
 *
 * Exports: useSavedWords
 * Depends on: React, ../lib/reactions, ../lib/saved-words
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  REACTIONS_EVENT,
  REACTIONS_KEY,
  flipReaction,
  hasReaction,
  type ReactionKind,
} from "../lib/reactions";
import { getFavoriteWords, getSavedWords, type SavedWord } from "../lib/saved-words";

type SavedLists = { saved: SavedWord[]; favorites: SavedWord[] };

/** Both lists in one pass, so a single re-read can never leave the tabs out of step. */
function readLists(): SavedLists {
  return { saved: getSavedWords(), favorites: getFavoriteWords() };
}

/**
 * Bookmarked and hearted words bound to localStorage.
 * @returns Both lists, the two gesture actions (remove / restore) and a manual re-read.
 */
export function useSavedWords() {
  const [lists, setLists] = useState<SavedLists>(() => readLists());

  const refresh = useCallback(() => setLists(readLists()), []);

  // Keep the latest refresh callback out of the listener deps so a re-render
  // cannot tear down and re-add the storage listener every time.
  const stable = useRef(refresh);
  useEffect(() => {
    stable.current = refresh;
  }, [refresh]);

  // Another tab flipping a reaction must show up here, and so must a write from
  // this tab (the native storage event skips the tab that wrote it).
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === REACTIONS_KEY) stable.current();
    };
    const reRead = () => stable.current();
    window.addEventListener("storage", onStorage);
    window.addEventListener(REACTIONS_EVENT, reRead);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(REACTIONS_EVENT, reRead);
    };
  }, []);

  /**
   * Take a word off one list by turning that reaction off, which also drops its save
   * stamp. Guarded on the current state so a repeated gesture cannot flip it back on.
   */
  const remove = useCallback((wordId: string, kind: ReactionKind) => {
    if (!wordId || !hasReaction(wordId, kind)) return;
    flipReaction(wordId, kind);
    stable.current();
  }, []);

  /**
   * Put a just-removed word back on its list. Passing the day it was filed under makes
   * the undo land in the same group the reader swiped from; omitting it stamps the word
   * as saved right now, which is what a fresh save should do.
   */
  const restore = useCallback((wordId: string, kind: ReactionKind, at?: number) => {
    if (!wordId || hasReaction(wordId, kind)) return;
    flipReaction(wordId, kind, at);
    stable.current();
  }, []);

  return { saved: lists.saved, favorites: lists.favorites, remove, restore, refresh };
}
