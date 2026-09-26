/** Fixed-height virtual window with anchor-preserving page eviction. Exports: useVocabularyWindow. Depends on: React, TanStack Virtual. */
import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { defaultRangeExtractor, useVirtualizer, type Range } from "@tanstack/react-virtual";
import type { FeedEntry } from "../types";

/** Fraction of one card the scroll must pass beyond a boundary before the active index may switch. */
const ACTIVE_HYSTERESIS = 0.08;

/**
 * Resolve the active card index with a deadzone so sub-threshold jitter at a snap
 * boundary cannot flip the active card back and forth (which strobes the backdrop
 * and remounts the kinetic word before it finishes playing).
 * @param frac - scroll offset expressed in fractional card units
 * @param current - currently active index
 * @param count - number of retained entries
 * @returns The stable active index
 * @pure true
 */
function resolveActiveIndex(frac: number, current: number, count: number): number {
  if (count <= 0) return 0;
  let index = current;
  if (frac > current + 0.5 + ACTIVE_HYSTERESIS) index = Math.ceil(frac - 0.5);
  else if (frac < current - 0.5 - ACTIVE_HYSTERESIS) index = Math.floor(frac + 0.5);
  return Math.max(0, Math.min(count - 1, index));
}

/** Virtualize a bounded page window without accumulating huge spacers. @param entries Contiguous occurrences. @returns Viewport bindings. */
export function useVocabularyWindow(entries: FeedEntry[]) {
  const viewport = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(() =>
    typeof window === "undefined" ? 800 : window.innerHeight,
  );
  const [activePosition, setActivePosition] = useState(0);
  const direction = useRef<"next" | "previous">("next");
  const lastTop = useRef(0);
  const adjusting = useRef(false);
  const firstPosition = entries[0]?.position ?? 0;
  const previous = useRef({ firstPosition, height });
  const activeIndex = Math.max(0, Math.min(entries.length - 1, activePosition - firstPosition));
  const rangeExtractor = useCallback(
    (range: Range) => {
      const indexes = defaultRangeExtractor(range);
      // Keep the active occurrence mounted while the layout effect rebases the scroll offset.
      if (activeIndex < range.count && !indexes.includes(activeIndex)) {
        indexes.push(activeIndex);
        indexes.sort((a, b) => a - b);
      }
      return indexes;
    },
    [activeIndex],
  );
  const getItemKey = useCallback((index: number) => entries[index].occurrenceId, [entries]);
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => viewport.current,
    estimateSize: () => height,
    getItemKey,
    rangeExtractor,
    overscan: 2,
  });

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measure = () => setHeight(Math.max(1, element.clientHeight));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const element = viewport.current;
    const old = previous.current;
    previous.current = { firstPosition, height };
    if (!element || (old.firstPosition === firstPosition && old.height === height)) return;
    adjusting.current = true;
    // Translate the same fractional occurrence into the newly retained coordinate window.
    const relative = element.scrollTop / old.height + old.firstPosition - firstPosition;
    // Snap to a whole card so the resting offset and the active index always agree exactly;
    // a fractional rest would let rounding flip the active card on the next scroll event.
    const index = Math.max(0, Math.min(Math.max(0, entries.length - 1), Math.round(relative)));
    const top = index * height;
    if (old.height !== height) virtualizer.measure();
    virtualizer.scrollToOffset(top, { behavior: "auto" });
    element.scrollTop = top;
    lastTop.current = top;
    setActivePosition(firstPosition + index);
    // Clear the guard on the next frame, with a timeout backstop so a throttled/hidden
    // rAF can never leave `adjusting` stuck true (which would freeze onScroll and move()).
    const frame = requestAnimationFrame(() => {
      adjusting.current = false;
    });
    const backstop = setTimeout(() => {
      adjusting.current = false;
    }, 120);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(backstop);
      adjusting.current = false;
    };
  }, [firstPosition, height, entries.length, virtualizer]);

  const onScroll = useCallback(() => {
    const element = viewport.current;
    if (!element || adjusting.current) return;
    const top = element.scrollTop;
    if (Math.abs(top - lastTop.current) > 1)
      direction.current = top > lastTop.current ? "next" : "previous";
    lastTop.current = top;
    const frac = top / height;
    // Deadzone resolution against the current index keeps boundary jitter from flipping cards.
    setActivePosition((previousPosition) => {
      const current = Math.max(0, Math.min(entries.length - 1, previousPosition - firstPosition));
      return firstPosition + resolveActiveIndex(frac, current, entries.length);
    });
  }, [entries.length, firstPosition, height]);

  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const move = useCallback(
    (delta: number) => {
      const run = () => {
        const index = Math.max(0, Math.min(entries.length - 1, activeIndexRef.current + delta));
        direction.current = delta < 0 ? "previous" : "next";
        virtualizer.scrollToIndex(index, { align: "start", behavior: "auto" });
      };
      // Never stack an advance on top of an in-flight scroll rebase; defer one frame.
      if (adjusting.current) requestAnimationFrame(run);
      else run();
    },
    [entries.length, virtualizer],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      event.target instanceof HTMLElement &&
      event.target.closest("button, input, select, textarea, a")
    )
      return;
    if (["ArrowDown", "PageDown", "ArrowUp", "PageUp"].includes(event.key)) {
      event.preventDefault();
      move(event.key === "ArrowDown" || event.key === "PageDown" ? 1 : -1);
    }
  };
  return {
    viewport,
    height,
    activeIndex,
    direction,
    adjusting,
    virtualizer,
    onScroll,
    onKeyDown,
    move,
  };
}
