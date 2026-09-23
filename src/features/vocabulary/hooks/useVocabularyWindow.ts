/** Fixed-height virtual window with anchor-preserving page eviction. Exports: useVocabularyWindow. Depends on: React, TanStack Virtual. */
import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { defaultRangeExtractor, useVirtualizer, type Range } from "@tanstack/react-virtual";
import type { FeedEntry } from "../types";

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
    const top = Math.max(0, Math.min(Math.max(0, entries.length - 1) * height, relative * height));
    if (old.height !== height) virtualizer.measure();
    virtualizer.scrollToOffset(top, { behavior: "auto" });
    element.scrollTop = top;
    lastTop.current = top;
    setActivePosition(firstPosition + Math.round(top / height));
    const frame = requestAnimationFrame(() => {
      adjusting.current = false;
    });
    return () => {
      cancelAnimationFrame(frame);
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
    setActivePosition(
      firstPosition + Math.max(0, Math.min(entries.length - 1, Math.round(top / height))),
    );
  }, [entries.length, firstPosition, height]);

  const move = useCallback(
    (delta: number) => {
      const index = Math.max(0, Math.min(entries.length - 1, activeIndex + delta));
      direction.current = delta < 0 ? "previous" : "next";
      virtualizer.scrollToIndex(index, { align: "start", behavior: "auto" });
    },
    [activeIndex, entries.length, virtualizer],
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
