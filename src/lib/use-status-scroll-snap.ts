import { useCallback, useEffect, useRef } from "react";

const SNAP_ITEM_SELECTOR = "[data-status-snap-item='true']";
const SNAP_SETTLE_MS = 120;
const PROGRAMMATIC_SCROLL_MS = 420;
const SNAP_EPSILON_PX = 1.5;

export function useStatusScrollSnap<T extends HTMLElement = HTMLElement>(itemCount: number) {
  const containerRef = useRef<T | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const programmaticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const isTouchingRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);

  const clearSettleTimer = useCallback(() => {
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const releaseProgrammaticScroll = useCallback(() => {
    if (programmaticTimerRef.current) {
      clearTimeout(programmaticTimerRef.current);
      programmaticTimerRef.current = null;
    }
    isProgrammaticScrollRef.current = false;
  }, []);

  const snapToNearest = useCallback((behavior: ScrollBehavior = "smooth") => {
    const container = containerRef.current;
    if (!container) return;

    const targetTop = getNearestTargetTop(container);
    if (Math.abs(container.scrollTop - targetTop) <= SNAP_EPSILON_PX) return;

    isProgrammaticScrollRef.current = true;
    container.scrollTo({ top: targetTop, behavior });

    if (programmaticTimerRef.current) clearTimeout(programmaticTimerRef.current);
    programmaticTimerRef.current = setTimeout(
      () => {
        isProgrammaticScrollRef.current = false;
        programmaticTimerRef.current = null;
      },
      behavior === "smooth" ? PROGRAMMATIC_SCROLL_MS : 0,
    );
  }, []);

  const scheduleSnap = useCallback(
    (behavior: ScrollBehavior = "smooth", delay = SNAP_SETTLE_MS) => {
      clearSettleTimer();
      settleTimerRef.current = setTimeout(() => {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          snapToNearest(behavior);
        });
      }, delay);
    },
    [clearSettleTimer, snapToNearest],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (isTouchingRef.current || isProgrammaticScrollRef.current) return;
      scheduleSnap("smooth");
    };
    const handleTouchStart = () => {
      isTouchingRef.current = true;
      clearSettleTimer();
      releaseProgrammaticScroll();
    };
    const handleTouchEnd = () => {
      isTouchingRef.current = false;
      scheduleSnap("smooth", SNAP_SETTLE_MS);
    };
    const handleGestureEnd = () => {
      if (isTouchingRef.current) return;
      scheduleSnap("smooth", 48);
    };
    const handleResize = () => scheduleSnap("auto", 0);

    container.addEventListener("scroll", handleScroll, { passive: true });
    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });
    container.addEventListener("touchcancel", handleTouchEnd, { passive: true });
    container.addEventListener("pointerup", handleGestureEnd, { passive: true });
    container.addEventListener("wheel", handleGestureEnd, { passive: true });
    container.addEventListener("scrollend", handleGestureEnd);
    window.addEventListener("resize", handleResize, { passive: true });
    window.addEventListener("orientationchange", handleResize);

    return () => {
      container.removeEventListener("scroll", handleScroll);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("touchcancel", handleTouchEnd);
      container.removeEventListener("pointerup", handleGestureEnd);
      container.removeEventListener("wheel", handleGestureEnd);
      container.removeEventListener("scrollend", handleGestureEnd);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      clearSettleTimer();
      releaseProgrammaticScroll();
    };
  }, [clearSettleTimer, releaseProgrammaticScroll, scheduleSnap]);

  useEffect(() => {
    scheduleSnap("auto", 0);
  }, [itemCount, scheduleSnap]);

  return containerRef;
}

function getNearestTargetTop(container: HTMLElement) {
  const items = Array.from(container.querySelectorAll<HTMLElement>(SNAP_ITEM_SELECTOR));
  const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);

  if (items.length === 0) {
    const pageHeight = Math.max(1, container.clientHeight || window.innerHeight);
    return clamp(Math.round(container.scrollTop / pageHeight) * pageHeight, 0, maxScrollTop);
  }

  const containerTop = container.getBoundingClientRect().top;
  const nearest = items.reduce<{ distance: number } | null>((best, item) => {
    const distance = item.getBoundingClientRect().top - containerTop;
    if (!best || Math.abs(distance) < Math.abs(best.distance)) return { distance };
    return best;
  }, null);

  return clamp(container.scrollTop + (nearest?.distance ?? 0), 0, maxScrollTop);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
