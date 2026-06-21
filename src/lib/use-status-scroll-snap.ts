import { useCallback, useEffect, useRef } from "react";

const SNAP_ITEM_SELECTOR = "[data-status-snap-item='true']";
const SNAP_SETTLE_MS = 90;

export function useStatusScrollSnap<T extends HTMLElement = HTMLElement>(itemCount: number) {
  const containerRef = useRef<T | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  const snapToNearest = useCallback((behavior: ScrollBehavior = "smooth") => {
    const container = containerRef.current;
    if (!container) return;

    const items = Array.from(container.querySelectorAll<HTMLElement>(SNAP_ITEM_SELECTOR));
    if (items.length === 0) return;

    const containerTop = container.getBoundingClientRect().top;
    const nearest = items.reduce<{ item: HTMLElement; distance: number } | null>((best, item) => {
      const distance = item.getBoundingClientRect().top - containerTop;
      if (!best || Math.abs(distance) < Math.abs(best.distance)) return { item, distance };
      return best;
    }, null);

    if (!nearest || Math.abs(nearest.distance) < 1) return;

    container.scrollTo({
      top: container.scrollTop + nearest.distance,
      behavior,
    });
  }, []);

  const scheduleSnap = useCallback(
    (behavior: ScrollBehavior = "smooth", delay = SNAP_SETTLE_MS) => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      settleTimerRef.current = setTimeout(() => {
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => snapToNearest(behavior));
      }, delay);
    },
    [snapToNearest],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => scheduleSnap("smooth");
    const handleGestureEnd = () => scheduleSnap("smooth", 24);
    const handleResize = () => scheduleSnap("auto", 0);

    container.addEventListener("scroll", handleScroll, { passive: true });
    container.addEventListener("touchend", handleGestureEnd, { passive: true });
    container.addEventListener("pointerup", handleGestureEnd, { passive: true });
    container.addEventListener("scrollend", handleGestureEnd);
    window.addEventListener("resize", handleResize, { passive: true });
    window.addEventListener("orientationchange", handleResize);

    return () => {
      container.removeEventListener("scroll", handleScroll);
      container.removeEventListener("touchend", handleGestureEnd);
      container.removeEventListener("pointerup", handleGestureEnd);
      container.removeEventListener("scrollend", handleGestureEnd);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [scheduleSnap]);

  useEffect(() => {
    scheduleSnap("auto", 0);
  }, [itemCount, scheduleSnap]);

  return containerRef;
}
