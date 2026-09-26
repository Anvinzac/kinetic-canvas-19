/** Bounded, full-screen vocabulary stream and network states. Exports: VocabularyStream. Depends on: feed/window hooks, VocabularyCard. */
import { useEffect, useRef } from "react";
import { useVocabularyFeed } from "../hooks/useVocabularyFeed";
import { useVocabularyWindow } from "../hooks/useVocabularyWindow";
import { useFeedPagination } from "../hooks/useFeedPagination";
import type { FeedPage, Presentation, VocabularyFilters } from "../types";
import { VocabularyCard } from "./VocabularyCard";

/** Render a single mounted session; remount on shuffle/filter changes. @param props Session and UI choices. @returns Virtualized feed. */
export function VocabularyStream({
  seed,
  filters,
  presentation,
  reducedMotion,
  suspended,
  onMetadata,
  onRestart,
  onClearFilters,
}: {
  seed: string;
  filters: VocabularyFilters;
  presentation: Presentation;
  reducedMotion: boolean;
  suspended: boolean;
  onMetadata: (page: FeedPage) => void;
  onRestart: () => void;
  onClearFilters: () => void;
}) {
  const query = useVocabularyFeed(seed, filters);
  const windowState = useVocabularyWindow(query.entries);
  const retry = useFeedPagination(query, windowState);
  const { viewport, height, activeIndex, virtualizer, onScroll, onKeyDown, move } = windowState;
  useEffect(() => {
    if (query.metadata) onMetadata(query.metadata);
  }, [query.metadata, onMetadata]);

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
      if (activeIndex < query.entries.length - 1) move(1);
    } else {
      // flick down -> previous word
      if (activeIndex > 0) move(-1);
    }
  };

  const empty = query.isSuccess && !query.entries.length;
  const initialError = query.isError && !query.entries.length;
  const exhausted =
    query.entries.length > 0 && !query.hasNextPage && activeIndex === query.entries.length - 1;
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
        {!query.entries.length && (
          <div className="vocab-empty" role="status">
            <p className="vocab-eyebrow">A word is a beginning</p>
            <h1>
              {initialError
                ? "Let’s try that again."
                : empty
                  ? "No words match just yet."
                  : query.isPaused
                    ? "Waiting for a connection."
                    : "Finding your first word…"}
            </h1>
            <p>
              {initialError
                ? "The word stream couldn’t load. Your settings are still here."
                : empty
                  ? "Try a different difficulty or category."
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
          </div>
        )}
        <div className="vocab-virtual-track" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((item) => {
            const entry = query.entries[item.index];
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
                  canAdvance={activeIndex < query.entries.length - 1}
                  onAdvance={() => move(1)}
                />
              </div>
            );
          })}
        </div>
      </div>
      {query.entries.length > 0 && (
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
