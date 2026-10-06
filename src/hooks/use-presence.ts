/** Keep a popup mounted through its exit animation. Exports: usePresence. */
import { useEffect, useState } from "react";

/**
 * Delay unmounting after `open` turns false so a closing animation can play. While
 * `closing` is true the element should run its exit animation and ignore input.
 * Reduced-motion readers skip the wait, since their animations are switched off.
 * @param open Whether the popup is logically open
 * @param exitMs Length of the exit animation
 * @returns `mounted` to gate rendering, `closing` to drive the exit styles
 */
export function usePresence(open: boolean, exitMs: number): { mounted: boolean; closing: boolean } {
  const [lingering, setLingering] = useState(open);
  useEffect(() => {
    if (open) {
      setLingering(true);
      return;
    }
    if (!lingering) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setLingering(false), reduced ? 0 : exitMs);
    return () => window.clearTimeout(timer);
  }, [open, lingering, exitMs]);
  return { mounted: open || lingering, closing: !open && lingering };
}
