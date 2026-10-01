/**
 * Bookmark count for toolbar badges. Lives in its own module and depends only on
 * the localStorage reaction leaf, so the feed chunk never has to bundle
 * catalog.json (which `lib/saved-words` imports) just to render a number.
 *
 * Exports: useSavedCount
 * Depends on: React, ../lib/reactions
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { REACTIONS_EVENT, REACTIONS_KEY, getBookmarkedWordIds } from "../lib/reactions";

/**
 * How many words this device has bookmarked, kept in sync with writes from the
 * saved-words page and from other tabs.
 * @returns Current bookmark count.
 */
export function useSavedCount(): number {
  const [count, setCount] = useState(() => getBookmarkedWordIds().length);
  const refresh = useCallback(() => setCount(getBookmarkedWordIds().length), []);

  // Keep the latest refresh callback out of the listener deps so a re-render
  // cannot tear down and re-add the storage listener every time.
  const stable = useRef(refresh);
  useEffect(() => {
    stable.current = refresh;
  }, [refresh]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === REACTIONS_KEY) stable.current();
    };
    // Three triggers, because each covers a different writer:
    //  - REACTIONS_EVENT: a tap in THIS tab (native storage skips the writer)
    //  - storage: a tap in ANOTHER tab
    //  - focus/visibility: a catch-all after bfcache restores or tab switches
    const refresh = () => stable.current();
    window.addEventListener("storage", onStorage);
    window.addEventListener(REACTIONS_EVENT, refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(REACTIONS_EVENT, refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  return count;
}
