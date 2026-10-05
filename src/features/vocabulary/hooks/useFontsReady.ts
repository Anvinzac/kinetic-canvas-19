/**
 * Hold the first clue until its typeface can draw Vietnamese.
 *
 * Web fonts arrive per Unicode subset. The Latin subset is usually cached or first
 * in line; the Vietnamese one is fetched only when an accented glyph is first laid
 * out — which, on a cold load, is the middle of the opening entrance. The reader
 * then watches "ờ", "ể" and "ự" snap from a fallback serif into the real face
 * while the words are still flying in. Asking for those glyphs up front, and
 * waiting briefly for them, moves that swap to before anything is on screen.
 *
 * Exports: useFontsReady
 * Depends on: React, ../lib/presets THEMES
 */

import { useEffect, useState } from "react";
import { THEMES } from "../lib/presets";

/** A cold network must never hold the feed hostage; after this the text shows regardless. */
const FONT_WAIT_MS = 1400;
/** Covers the stacked-diacritic range the Vietnamese subset exists for. */
const VIETNAMESE_SAMPLE = "Người thể dựa ờ ể ự ỗ ặ";
/** The weights the kinetic stage actually paints: body and emphasis. */
const STAGE_WEIGHTS = [800, 900] as const;

/**
 * Whether the feed's display faces are ready to draw Vietnamese text.
 * @returns false until every theme font has its Vietnamese glyphs (or the wait expires)
 */
export function useFontsReady(): boolean {
  const [ready, setReady] = useState(
    () => typeof document === "undefined" || !document.fonts?.load,
  );
  useEffect(() => {
    if (ready) return;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      setReady(true);
    };
    const families = Array.from(new Set(THEMES.map((theme) => theme.font)));
    const loads = families.flatMap((family) =>
      STAGE_WEIGHTS.map((weight) =>
        document.fonts.load(`${weight} 64px "${family}"`, VIETNAMESE_SAMPLE),
      ),
    );
    // allSettled: one family failing to load must not keep the others waiting.
    void Promise.allSettled(loads).then(finish);
    const timer = window.setTimeout(finish, FONT_WAIT_MS);
    return () => {
      settled = true;
      window.clearTimeout(timer);
    };
  }, [ready]);
  return ready;
}
