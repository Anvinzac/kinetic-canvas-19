/**
 * Social TanStack Query option factories (feed + post).
 *
 * Exports: feedQueryOptions, postQueryOptions
 * Depends on: shared/api-client, features/demo mocks, socialKeys
 */

import { queryOptions } from "@tanstack/react-query";
import type { DataMode } from "@/features/session";
import { getMockFeed, getMockPost } from "@/lib/mock-data";
import { runDataMode } from "@/shared/api-client";
import type { SocialFeedData, SocialPostData } from "@/shared/types";
import { socialKeys } from "./keys";

/**
 * Build TanStack Query options for the authenticated feed.
 * @param mode - demo or live query-key segment
 * @param fetchLive - live serverFn caller from the route/hook
 * @returns queryOptions with historical key/staleTime behavior
 */
export function feedQueryOptions(
  mode: DataMode,
  fetchLive: () => Promise<SocialFeedData>,
) {
  return queryOptions({
    queryKey: socialKeys.feed(mode),
    queryFn: (): Promise<SocialFeedData> =>
      runDataMode({ demo: () => getMockFeed(), live: fetchLive }, mode),
    staleTime: 30_000,
  });
}

/**
 * Build TanStack Query options for a single post permalink.
 * @param mode - demo or live query-key segment
 * @param postId - post UUID
 * @param fetchLive - live serverFn caller from the route/hook
 * @returns queryOptions matching historical post key behavior
 */
export function postQueryOptions(
  mode: DataMode,
  postId: string,
  fetchLive: () => Promise<SocialPostData>,
) {
  return queryOptions({
    queryKey: socialKeys.post(mode, postId),
    queryFn: (): Promise<SocialPostData> =>
      runDataMode({ demo: () => getMockPost(postId), live: fetchLive }, mode),
    staleTime: 30_000,
    retry: false,
  });
}
