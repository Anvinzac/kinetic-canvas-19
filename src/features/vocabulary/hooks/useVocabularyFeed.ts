/** Bounded, bidirectional query state for a single vocabulary stream. Exports: useVocabularyFeed. Depends on: React Query, fetch adapter, backfill bounds, session tracker. */
import { useEffect, useMemo, useRef } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { fetchVocabularyPage, VocabularyRequestError } from "../api/feed";
import { VOCAB_MAX_PAGES } from "../lib/backfill";
import type { FeedCursor, VocabularyFilters } from "../types";
import { markReportedOnce, reportVisitorEvent } from "@/lib/session-tracker";

/** Load deterministic pages, retaining at most VOCAB_MAX_PAGES of them. @param seed Stable visit seed. @param filters Content filters. @returns Query and flattened cards. */
export function useVocabularyFeed(seed: string, filters: VocabularyFilters) {
  const client = useQueryClient();
  const queryKey = useMemo(
    () => ["vocabulary", seed, filters.topic, filters.level, filters.difficulty],
    [seed, filters.topic, filters.level, filters.difficulty],
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
    maxPages: VOCAB_MAX_PAGES,
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

  // Session-level telemetry. One load is reported per visit, but every distinct
  // failure is, so the failure rate reflects retries rather than hiding them.
  const prevStatusRef = useRef<"pending" | "success" | "error">("pending");
  useEffect(() => {
    const status = query.isLoading ? "pending" : query.isError ? "error" : "success";
    if (status === prevStatusRef.current) return;
    prevStatusRef.current = status;

    if (status === "success" && query.data?.pages.length) {
      if (!markReportedOnce("vocabulary_feed.loaded")) return;
      reportVisitorEvent({
        type: "page.loaded",
        metadata: {
          surface: "vocabulary_feed",
          entries: query.data.pages.flatMap((p) => p.entries).length,
        },
      });
    } else if (status === "error" && query.error) {
      reportVisitorEvent({
        type: "page.failed",
        message: query.error instanceof Error ? query.error.message : String(query.error),
        metadata: {
          surface: "vocabulary_feed",
          code: query.error instanceof VocabularyRequestError ? query.error.code : null,
        },
      });
    }
  }, [query.isLoading, query.isError, query.error, query.data]);

  const entries = useMemo(
    () => query.data?.pages.flatMap((page) => page.entries) ?? [],
    [query.data],
  );
  const catalogChanged =
    query.error instanceof VocabularyRequestError && query.error.code === "CATALOG_CHANGED";
  return { ...query, entries, metadata: query.data?.pages[0], catalogChanged };
}
