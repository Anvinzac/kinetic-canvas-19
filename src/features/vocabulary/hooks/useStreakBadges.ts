/**
 * The milestones this device has earned, kept in sync with writes from the feed.
 *
 * The same three-trigger shape as ./useSavedCount, for the same reasons, and it depends only
 * on the storage leaf so the saved page never pulls a catalog in to render a chip.
 *
 * Exports: useStreakBadges
 * Depends on: React, ../lib/streak
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { STREAK_EVENT, STREAK_KEY, readStreak } from "../lib/streak";

/**
 * @returns Earned milestones in days, ascending; empty until the first is reached
 */
export function useStreakBadges(): number[] {
  const [badges, setBadges] = useState<number[]>(() => readStreak().earned);
  const refresh = useCallback(() => setBadges(readStreak().earned), []);

  // Keep the latest callback out of the listener deps so a re-render cannot tear down and
  // re-add the listeners every time.
  const stable = useRef(refresh);
  useEffect(() => {
    stable.current = refresh;
  }, [refresh]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STREAK_KEY) stable.current();
    };
    // Three triggers, because each covers a different writer:
    //  - STREAK_EVENT: a word finished in THIS tab (native storage skips the writer)
    //  - storage: a word finished in ANOTHER tab
    //  - focus/visibility: a catch-all after bfcache restores or tab switches
    const refreshNow = () => stable.current();
    window.addEventListener("storage", onStorage);
    window.addEventListener(STREAK_EVENT, refreshNow);
    window.addEventListener("focus", refreshNow);
    document.addEventListener("visibilitychange", refreshNow);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(STREAK_EVENT, refreshNow);
      window.removeEventListener("focus", refreshNow);
      document.removeEventListener("visibilitychange", refreshNow);
    };
  }, []);

  return badges;
}
