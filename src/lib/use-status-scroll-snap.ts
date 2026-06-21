import { useCallback, useEffect, useRef } from "react";

const SNAP_ITEM_SELECTOR = "[data-status-snap-item='true']";
const SNAP_SETTLE_MS = 90;
const SWIPE_PAGE_THRESHOLD = 0.16;
const SWIPE_VELOCITY_THRESHOLD = 0.22;
const MIN_SWIPE_TRAVEL_PX = 28;
const TOUCH_SLOP_PX = 8;

export function useStatusScrollSnap<T extends HTMLElement = HTMLElement>(itemCount: number) {
  const containerRef = useRef<T | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStateRef = useRef<{
    active: boolean;
    dragging: boolean;
    startY: number;
    lastY: number;
    startTime: number;
    lastTime: number;
    previousY: number;
    previousTime: number;
    startScrollTop: number;
    startIndex: number;
  } | null>(null);

  const getPageHeight = useCallback(() => {
    const container = containerRef.current;
    return Math.max(1, container?.clientHeight ?? window.innerHeight);
  }, []);

  const getMaxIndex = useCallback(() => {
    const container = containerRef.current;
    if (!container) return Math.max(0, itemCount - 1);
    const measured = container.querySelectorAll(SNAP_ITEM_SELECTOR).length;
    return Math.max(0, Math.max(itemCount, measured) - 1);
  }, [itemCount]);

  const getNearestIndex = useCallback(() => {
    const container = containerRef.current;
    if (!container) return 0;
    return clamp(Math.round(container.scrollTop / getPageHeight()), 0, getMaxIndex());
  }, [getMaxIndex, getPageHeight]);

  const forceScrollTop = useCallback((top: number) => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTop = top;
  }, []);

  const releaseSnapLock = useCallback(() => {
    const container = containerRef.current;
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }
    if (container) delete container.dataset.snapLock;
  }, []);

  const snapToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      const container = containerRef.current;
      if (!container) return;

      const targetIndex = clamp(index, 0, getMaxIndex());
      const targetTop = getTargetTop(container, targetIndex, getPageHeight());
      container.dataset.snapLock = "true";
      container.scrollTo({ top: targetTop, behavior });

      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      const settle = behavior === "smooth" ? 320 : 0;
      lockTimerRef.current = setTimeout(() => {
        forceScrollTop(targetTop);
        delete container.dataset.snapLock;
        lockTimerRef.current = null;
      }, settle);
    },
    [forceScrollTop, getMaxIndex, getPageHeight],
  );

  const snapToNearest = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
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

      const index = Math.max(0, items.indexOf(nearest.item));
      snapToIndex(index, behavior);
    },
    [snapToIndex],
  );

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

    const handleScroll = () => {
      if (container.dataset.snapLock === "true" || touchStateRef.current?.active) return;
      scheduleSnap("smooth");
    };
    const handleGestureEnd = () => {
      if (touchStateRef.current?.active) return;
      scheduleSnap("smooth", 24);
    };
    const handleResize = () => snapToIndex(getNearestIndex(), "auto");
    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      releaseSnapLock();
      const touch = event.touches[0];
      const now = performance.now();
      touchStateRef.current = {
        active: true,
        dragging: false,
        startY: touch.clientY,
        lastY: touch.clientY,
        startTime: now,
        lastTime: now,
        previousY: touch.clientY,
        previousTime: now,
        startScrollTop: container.scrollTop,
        startIndex: getNearestIndex(),
      };
    };
    const handleTouchMove = (event: TouchEvent) => {
      const state = touchStateRef.current;
      if (!state?.active || event.touches.length !== 1) return;

      const touch = event.touches[0];
      const now = performance.now();
      const deltaY = state.startY - touch.clientY;
      if (!state.dragging && Math.abs(deltaY) < TOUCH_SLOP_PX) return;

      state.dragging = true;
      state.previousY = state.lastY;
      state.previousTime = state.lastTime;
      state.lastY = touch.clientY;
      state.lastTime = now;
      if (event.cancelable) event.preventDefault();

      const maxTop = getTargetTop(container, getMaxIndex(), getPageHeight());
      container.dataset.snapLock = "true";
      container.scrollTop = clamp(state.startScrollTop + deltaY, 0, maxTop);
    };
    const handleTouchEnd = () => {
      const state = touchStateRef.current;
      touchStateRef.current = null;
      if (!state) return;

      delete container.dataset.snapLock;
      if (!state.dragging) {
        scheduleSnap("smooth", 0);
        return;
      }

      const pageHeight = getPageHeight();
      const travel = state.startY - state.lastY;
      const elapsed = Math.max(1, state.lastTime - state.startTime);
      const totalVelocity = travel / elapsed;
      const recentTravel = state.previousY - state.lastY;
      const recentElapsed = Math.max(1, state.lastTime - state.previousTime);
      const recentVelocity = recentTravel / recentElapsed;
      const velocity =
        Math.abs(recentVelocity) > Math.abs(totalVelocity) ? recentVelocity : totalVelocity;
      let targetIndex = state.startIndex;
      const hasIntentionalSwipe = Math.abs(travel) >= MIN_SWIPE_TRAVEL_PX;

      if (
        travel > pageHeight * SWIPE_PAGE_THRESHOLD ||
        (hasIntentionalSwipe && velocity > SWIPE_VELOCITY_THRESHOLD)
      ) {
        targetIndex += 1;
      } else if (
        travel < -pageHeight * SWIPE_PAGE_THRESHOLD ||
        (hasIntentionalSwipe && velocity < -SWIPE_VELOCITY_THRESHOLD)
      ) {
        targetIndex -= 1;
      } else {
        targetIndex = getNearestIndex();
      }

      snapToIndex(targetIndex, "smooth");
    };
    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 4) return;
      if (event.cancelable) event.preventDefault();
      if (container.dataset.snapLock === "true") return;
      snapToIndex(getNearestIndex() + Math.sign(event.deltaY), "smooth");
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });
    container.addEventListener("touchcancel", handleTouchEnd, { passive: true });
    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("pointerup", handleGestureEnd, { passive: true });
    container.addEventListener("scrollend", handleGestureEnd);
    window.addEventListener("resize", handleResize, { passive: true });
    window.addEventListener("orientationchange", handleResize);

    return () => {
      container.removeEventListener("scroll", handleScroll);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("touchcancel", handleTouchEnd);
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("pointerup", handleGestureEnd);
      container.removeEventListener("scrollend", handleGestureEnd);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [getMaxIndex, getNearestIndex, getPageHeight, releaseSnapLock, scheduleSnap, snapToIndex]);

  useEffect(() => {
    snapToIndex(getNearestIndex(), "auto");
  }, [getNearestIndex, itemCount, snapToIndex]);

  return containerRef;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getTargetTop(container: HTMLElement, index: number, pageHeight: number) {
  const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
  return clamp(index * pageHeight, 0, maxScrollTop);
}
