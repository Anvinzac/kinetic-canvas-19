/** Bounded, full-screen vocabulary stream and network states. Exports: VocabularyStream. Depends on: feed/window hooks, backfill bounds, VocabularyCard. */
import { useEffect, useMemo, useRef, useState } from "react";
import { useVocabularyFeed } from "../hooks/useVocabularyFeed";
import { useVocabularyWindow } from "../hooks/useVocabularyWindow";
import { useFeedPagination } from "../hooks/useFeedPagination";
import { canWalkFurther, getWalkedPositions } from "../lib/backfill";
import {
  formatCountdown,
  isWordAllowed,
  nextAvailableAt,
  type ViewHistory,
} from "../lib/history";
import type { FeedPage, Presentation, VocabularyFilters } from "../types";
import { VocabularyCard } from "./VocabularyCard";

/** Render a single mounted session; remount on shuffle/filter changes. @param props Session and UI choices. @returns Virtualized feed. */
export function VocabularyStream({
  seed,
  filters,
  presentation,
  reducedMotion,
  suspended,
  history,
  onRecordView,
  onClearHistory,
  onMetadata,
  onRestart,
  onClearFilters,
}: {
  seed: string;
  filters: VocabularyFilters;
  presentation: Presentation;
  reducedMotion: boolean;
  suspended: boolean;
  history: ViewHistory;
  onRecordView: (wordId: string) => void;
  onClearHistory: () => void;
  onMetadata: (page: FeedPage) => void;
  onRestart: () => void;
  onClearFilters: () => void;
}) {
  const query = useVocabularyFeed(seed, filters);
  // Tick so day-window expiries re-evaluate without a reload.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Occurrences admitted before they were recorded stay mounted so the
  // current card never vanishes the moment its view is stored.
  const admitted = useRef(new Set<string>());
  const visibleEntries = useMemo(() => {
    const out: typeof query.entries = [];
    for (const entry of query.entries) {
      if (admitted.current.has(entry.occurrenceId)) {
        out.push(entry);
        continue;
      }
      if (isWordAllowed(history, entry.word.id, now)) {
        admitted.current.add(entry.occurrenceId);
        out.push(entry);
      }
    }
    return out;
  }, [query.entries, history, now]);

  const windowState = useVocabularyWindow(visibleEntries);
  // Paging ceiling: the endpoint permutes the same pool forever, so hasNextPage stays
  // true even when every word it can offer is already buffered (and blocked by the
  // day history). Without this bound the backfill effect below re-arms on every
  // response — measured at ~144 requests/second with the pool exhausted — and each
  // cycle re-renders the empty-state panel, which is why the “Reset viewing history”
  // button flickered too fast to read or tap while no word ever played.
  const canFetchMorePositions = canWalkFurther(
    query.metadata?.matching ?? 0,
    getWalkedPositions(query.entries),
  );
  const feedForPaging = useMemo(
    () => ({ ...query, entries: visibleEntries }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query.data, query.hasNextPage, query.hasPreviousPage, query.isFetching, visibleEntries],
  );
  const retry = useFeedPagination(
    feedForPaging as unknown as ReturnType<typeof useVocabularyFeed>,
    windowState,
    canFetchMorePositions,
  );
  const { viewport, height, activeIndex, virtualizer, onScroll, onKeyDown, move } = windowState;
  useEffect(() => {
    if (query.metadata) onMetadata(query.metadata);
  }, [query.metadata, onMetadata]);

  // Record a view once per occurrence when its card becomes active.
  const recorded = useRef(new Set<string>());
  const activeEntry = visibleEntries[activeIndex];
  useEffect(() => {
    if (!activeEntry || suspended) return;
    if (recorded.current.has(activeEntry.occurrenceId)) return;
    recorded.current.add(activeEntry.occurrenceId);
    onRecordView(activeEntry.word.id);
  }, [activeEntry, suspended, onRecordView]);

  // Backfill: blocked words shrink the visible list, so pull more server
  // positions until enough showable words are buffered (bounded by maxPages and by
  // the paging ceiling above, which is what actually stops an exhausted pool).
  useEffect(() => {
    if (
      query.entries.length > 0 &&
      visibleEntries.length < 6 &&
      canFetchMorePositions &&
      query.hasNextPage &&
      !query.isFetching &&
      !query.isPaused &&
      !query.error
    ) {
      void query.fetchNextPage({ cancelRefetch: false });
    }
  }, [
    query.entries.length,
    visibleEntries.length,
    canFetchMorePositions,
    query.hasNextPage,
    query.isFetching,
    query.isPaused,
    query.error,
    query.fetchNextPage,
  ]);

  // Natural vertical flick gestures: flick up -> next word, flick down -> previous word
  const flickStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const handleFlickStart = (x: number, y: number) => {
    flickStart.current = { x, y, t: Date.now() };
  };
  const handleFlickEnd = (x: number, y: number) => {
    const start = flickStart.current;
    flickStart.current = null;
    if (!start || suspended) return;
    const dx = x - start.x;
    const dy = y - start.y;
    const dt = Date.now() - start.t;
    // Require a decisive vertical swipe; ignore horizontal card gestures
    if (Math.abs(dy) < 52 || Math.abs(dy) < Math.abs(dx) * 1.1) return;
    if (dt > 700) return;
    // Velocity hint: short duration + sufficient distance already gated; allow both directions
    if (dy < 0) {
      // flick up -> next word
      if (activeIndex < visibleEntries.length - 1) move(1);
    } else {
      // flick down -> previous word
      if (activeIndex > 0) move(-1);
    }
  };

  const empty = query.isSuccess && !query.entries.length;
  const initialError = query.isError && !query.entries.length;
  // A prefetch that can no longer find unseen words must not hide the blocked state:
  // gating on bare isFetching made this panel blink once per request.
  const backfillInFlight = query.isFetching && canFetchMorePositions;
  const allBlocked =
    query.entries.length > 0 && visibleEntries.length === 0 && !backfillInFlight && !initialError;
  const exhausted =
    visibleEntries.length > 0 &&
    (!query.hasNextPage || !canFetchMorePositions) &&
    activeIndex === visibleEntries.length - 1;
  const nextUnlock = useMemo(() => {
    if (!allBlocked) return null;
    const ids = new Set(query.entries.map((entry) => entry.word.id));
    let target = Number.POSITIVE_INFINITY;
    for (const id of ids) target = Math.min(target, nextAvailableAt(history, id, now));
    return Number.isFinite(target) ? target : null;
  }, [allBlocked, query.entries, history, now]);

  return (
    <>
      <div
        ref={viewport}
        className="vocab-viewport"
        role="feed"
        aria-label="Endless English vocabulary"
        aria-busy={query.isFetching}
        tabIndex={0}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        onTouchStart={(e) => {
          const t = e.touches[0];
          if (t) handleFlickStart(t.clientX, t.clientY);
        }}
        onTouchEnd={(e) => {
          const t = e.changedTouches[0];
          if (t) handleFlickEnd(t.clientX, t.clientY);
        }}
        inert={suspended}
      >
        {!visibleEntries.length && (
          <div className="vocab-empty" role="status">
            <p className="vocab-eyebrow">A word is a beginning</p>
            <h1>
              {initialError
                ? "Let’s try that again."
                : empty
                  ? "No words match just yet."
                  : allBlocked
                    ? "You’ve seen every word for now."
                    : query.isPaused
                      ? "Waiting for a connection."
                      : query.entries.length
                        ? "Finding a word you haven’t seen…"
                        : "Finding your first word…"}
            </h1>
            <p>
              {initialError
                ? "The word stream couldn’t load. Your settings are still here."
                : empty
                  ? "Try a different difficulty or category."
                  : allBlocked
                    ? `On-device memory holds each word to once a day, twice in 3 days, three times a week.${
                        nextUnlock ? ` Next word unlocks in ${formatCountdown(nextUnlock, now)}.` : ""
                      }`
                    : "Vietnamese clues. English discoveries. No sign-in needed."}
            </p>
            {initialError && (
              <button
                type="button"
                className="vocab-light-button"
                onClick={query.catalogChanged || exhausted ? onRestart : retry}
              >
                {query.catalogChanged ? "Start a fresh stream" : "Retry"}
              </button>
            )}
            {empty && (
              <button type="button" className="vocab-light-button" onClick={onClearFilters}>
                Show all words
              </button>
            )}
            {allBlocked && (
              <button type="button" className="vocab-light-button" onClick={onClearHistory}>
                Reset viewing history
              </button>
            )}
          </div>
        )}
        <div className="vocab-virtual-track" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((item) => {
            const entry = visibleEntries[item.index];
            if (!entry) return null;
            return (
              <div
                key={item.key}
                className="vocab-slot"
                style={{ height, transform: `translateY(${item.start}px)` }}
              >
                <VocabularyCard
                  key={`${entry.occurrenceId}:${presentation.style}`}
                  entry={entry}
                  active={item.index === activeIndex && !suspended}
                  presentation={presentation}
                  reducedMotion={reducedMotion}
                  matching={query.metadata?.matching ?? 0}
                  canAdvance={activeIndex < visibleEntries.length - 1}
                  onAdvance={() => move(1)}
                />
              </div>
            );
          })}
        </div>
      </div>
      {visibleEntries.length > 0 && (
        <>
          {(query.error || query.isPaused || exhausted) && (
            <div className="vocab-stream-status" role="status">
              <span>
                {query.catalogChanged
                  ? "New catalog available. Restart to load it."
                  : exhausted
                    ? "Ready for another shuffle? Start a fresh stream."
                    : query.isPaused
                      ? "Offline — loaded words are still available."
                      : "Couldn’t load more words."}
              </span>
              <button
                type="button"
                onClick={query.catalogChanged || exhausted ? onRestart : retry}
                disabled={query.isFetching}
              >
                {query.catalogChanged || exhausted ? "Restart" : "Retry"}
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
