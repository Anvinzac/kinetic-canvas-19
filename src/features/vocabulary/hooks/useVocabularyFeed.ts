/** Bounded, bidirectional query state for a single vocabulary stream. Exports: useVocabularyFeed. Depends on: React Query, fetch adapter. */
import { useEffect, useMemo } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { fetchVocabularyPage, VocabularyRequestError } from "../api/feed";
import type { FeedCursor, VocabularyFilters } from "../types";

/** Load deterministic pages, retaining at most 120 cards. @param seed Stable visit seed. @param filters Content filters. @returns Query and flattened cards. */
export function useVocabularyFeed(seed: string, filters: VocabularyFilters) {
  const client = useQueryClient();
  const queryKey = useMemo(
    () => ["vocabulary", seed, filters.topic, filters.level],
    [seed, filters.topic, filters.level],
  );
  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: { position: 0 } as FeedCursor,
    queryFn: ({ pageParam, signal }) =>
      fetchVocabularyPage({ seed, filters, cursor: pageParam, signal }),
    getNextPageParam: (last) =>
      last.nextPosition === null
        ? undefined
        : { position: last.nextPosition, revision: last.revision },
    getPreviousPageParam: (first) =>
      first.previousPosition === null
        ? undefined
        : { position: first.previousPosition, revision: first.revision },
    maxPages: 10,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: (attempt, error) =>
      !(
        error instanceof VocabularyRequestError &&
        ["CATALOG_CHANGED", "INVALID_REQUEST"].includes(error.code)
      ) && attempt < 2,
  });
  useEffect(
    () => () => {
      void client.cancelQueries({ queryKey, exact: true });
    },
    [client, queryKey],
  );
  const entries = useMemo(
    () => query.data?.pages.flatMap((page) => page.entries) ?? [],
    [query.data],
  );
  const catalogChanged =
    query.error instanceof VocabularyRequestError && query.error.code === "CATALOG_CHANGED";
  return { ...query, entries, metadata: query.data?.pages[0], catalogChanged };
}
