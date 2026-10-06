/** Visibility-aware clue playback that auto-plays pages and finishes the card. Exports: useLearningPlayback. Depends on: React. */
import { useEffect, useRef, useState } from "react";

/** Advance clues while visible; once the reveal is reached, signal the stream to load the next word. @param options Playback configuration. @returns Stage state and navigation. */
export function useLearningPlayback(options: {
  count: number;
  active: boolean;
  autoplay: boolean;
  reducedMotion: boolean;
  durations: number[];
  canAdvance: boolean;
  /**
   * Page that `reveal()` jumps to. Defaults to the last page; the vocabulary
   * card passes the reveal stage index because it appends a spelling coda after
   * it, and "reveal" must land on the answer rather than on the coda.
   */
  revealPage?: number;
  onFinish?: () => void;
}) {
  const [page, setPage] = useState(0);
  const [replay, setReplay] = useState(0);
  const [visible, setVisible] = useState(() => typeof document === "undefined" || !document.hidden);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  // A physical rotation can strand `visible`: the rotate-to-portrait gate releases the
  // screen wake lock while it is up, so a phone left in landscape may dim or sleep. On
  // rotate-back the matching `visibilitychange -> visible` can be missed or race this
  // hook's listeners, leaving `visible` stuck false — which keeps `playing` (and so the
  // auto-advance timer) permanently off even though the card is active again. Re-read the
  // authoritative `document.hidden` the moment the card becomes active, plus on focus and
  // bfcache restore, so playback always resumes without needing a manual tap.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (options.active) setVisible(!document.hidden);
    const resync = () => setVisible(!document.hidden);
    window.addEventListener("focus", resync);
    window.addEventListener("pageshow", resync);
    return () => {
      window.removeEventListener("focus", resync);
      window.removeEventListener("pageshow", resync);
    };
  }, [options.active]);
  const playing = options.active && visible && options.autoplay && !options.reducedMotion;
  const isLast = page >= options.count - 1;
  const duration = options.durations[page] ?? 3200;
  // Keep the latest finish callback without retriggering the timer every render.
  const finishRef = useRef(options.onFinish);
  useEffect(() => {
    finishRef.current = options.onFinish;
  }, [options.onFinish]);
  useEffect(() => {
    if (!playing || !options.autoplay) return;
    if (!isLast) {
      const timer = setTimeout(
        () => setPage((current) => Math.min(current + 1, options.count - 1)),
        duration,
      );
      return () => clearTimeout(timer);
    }
    // Wait for a buffered next word; retry/reconnect must not strand the reveal.
    if (!options.canAdvance) return;
    const timer = setTimeout(() => finishRef.current?.(), duration);
    return () => clearTimeout(timer);
  }, [
    playing,
    options.autoplay,
    options.count,
    options.canAdvance,
    duration,
    isLast,
    page,
    replay,
  ]);
  return {
    page,
    playing,
    duration,
    replay,
    previous: () => setPage((current) => Math.max(0, current - 1)),
    next: () => setPage((current) => Math.min(options.count - 1, current + 1)),
    reveal: () => setPage(options.revealPage ?? options.count - 1),
    restart: () => {
      setPage(0);
      setReplay((current) => current + 1);
    },
  };
}
