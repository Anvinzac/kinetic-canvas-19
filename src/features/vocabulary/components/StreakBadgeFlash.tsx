/**
 * The badge that lands when a streak milestone is earned.
 *
 * Decorative and CSS-driven, like RevealBurst: no framer-motion, no entrance clock. It is
 * not part of the kinetic word sequence, so usePausableEntrance would do nothing for it —
 * that hook only reads a clock WordSequenceText provides.
 *
 * It retires on a timer rather than on `animationend`, which is a deliberate departure from
 * how the pause pop dismisses itself. The blanket `prefers-reduced-motion` rule in
 * vocabulary.css sets `animation: none` on everything under the shell, so an animationend
 * listener never fires for a reduced-motion reader and the badge would sit on screen
 * forever. The card sidesteps that by not rendering the pause pop at all under reduced
 * motion; that would be the wrong answer here, because a reader who turned animations off
 * still earned the milestone and should still be told.
 *
 * The lifetime is passed into CSS as a custom property rather than written in both places,
 * so the timer and the animation cannot drift apart.
 *
 * Exports: StreakBadgeFlash, STREAK_FLASH_MS
 * Depends on: React
 */

import { useEffect, type CSSProperties } from "react";

/** How long the badge stays on screen, animation included. */
export const STREAK_FLASH_MS = 2200;

/**
 * @param days - The milestone being celebrated, in days
 * @param onDone - Called once the badge has had its time
 */
export function StreakBadgeFlash({ days, onDone }: { days: number; onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, STREAK_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      className="vocab-streak-flash"
      role="status"
      style={{ "--vocab-streak-dur": `${STREAK_FLASH_MS}ms` } as CSSProperties}
    >
      <div className="vocab-streak-flash-disc">
        <strong className="vocab-streak-flash-days">{days}</strong>
        <span className="vocab-streak-flash-unit">ngày</span>
      </div>
      <p className="vocab-streak-flash-caption">Chuỗi ngày liền tay!</p>
    </div>
  );
}
