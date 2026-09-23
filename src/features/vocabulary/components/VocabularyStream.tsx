/** Bounded, full-screen vocabulary stream and network states. Exports: VocabularyStream. Depends on: feed/window hooks, VocabularyCard. */
import { useEffect } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
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
                  ? "Try a different topic or level."
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
          <nav className="vocab-scroll-nav" aria-label="Word navigation" inert={suspended}>
            <button
              type="button"
              className="vocab-icon-button"
              onClick={() => move(-1)}
              disabled={activeIndex === 0}
              aria-label="Previous word"
            >
              <ArrowUp size={18} />
            </button>
            <span aria-live="polite">
              {query.isFetching
                ? "Loading words…"
                : presentation.autoplay && !reducedMotion
                  ? "Autoplay · swipe to skip"
                  : "Scroll for another word"}
            </span>
            <button
              type="button"
              className="vocab-icon-button"
              onClick={() => move(1)}
              disabled={activeIndex >= query.entries.length - 1}
              aria-label="Next word"
            >
              <ArrowDown size={18} />
            </button>
          </nav>
        </>
      )}
    </>
  );
}
