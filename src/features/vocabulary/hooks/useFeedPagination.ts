/** Edge prefetch and reconnect recovery without retry loops. Exports: useFeedPagination. Depends on: query/window hooks. */
import { useCallback, useEffect } from "react";
import type { useVocabularyFeed } from "./useVocabularyFeed";
import type { useVocabularyWindow } from "./useVocabularyWindow";

/** Prefetch only in the direction of travel. @param query Feed query. @param windowState Virtual viewport. @returns Explicit retry handler. */
export function useFeedPagination(
  query: ReturnType<typeof useVocabularyFeed>,
  windowState: ReturnType<typeof useVocabularyWindow>,
) {
  const { activeIndex, direction, adjusting } = windowState;
  const {
    entries,
    isFetching,
    error,
    hasNextPage,
    hasPreviousPage,
    fetchNextPage,
    fetchPreviousPage,
  } = query;
  useEffect(() => {
    if (adjusting.current || isFetching || error || !entries.length) return;
    if (direction.current === "next" && activeIndex >= entries.length - 4 && hasNextPage) {
      void fetchNextPage({ cancelRefetch: false });
    } else if (direction.current === "previous" && activeIndex <= 3 && hasPreviousPage) {
      void fetchPreviousPage({ cancelRefetch: false });
    }
  }, [
    activeIndex,
    direction,
    adjusting,
    entries,
    isFetching,
    error,
    hasNextPage,
    hasPreviousPage,
    fetchNextPage,
    fetchPreviousPage,
  ]);

  const { catalogChanged, isFetchPreviousPageError, isFetchNextPageError, refetch } = query;
  const retry = useCallback(() => {
    if (isFetching || catalogChanged) return;
    if (isFetchPreviousPageError) void fetchPreviousPage({ cancelRefetch: false });
    else if (isFetchNextPageError) void fetchNextPage({ cancelRefetch: false });
    else void refetch({ cancelRefetch: false });
  }, [
    isFetching,
    catalogChanged,
    isFetchPreviousPageError,
    isFetchNextPageError,
    fetchPreviousPage,
    fetchNextPage,
    refetch,
  ]);
  useEffect(() => {
    const online = () => {
      if (error) retry();
    };
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [error, retry]);
  return retry;
}
