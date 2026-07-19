import { queryOptions } from "@tanstack/react-query";
import type { DataMode } from "@/features/session";
import { getMockFeed, getMockPost } from "@/lib/mock-data";
import type { SocialFeedData, SocialPostData } from "@/shared/types";
import { socialKeys } from "./keys";

/**
 * @responsibility Build TanStack Query options for the authenticated feed.
 * @inputs data mode + live fetcher (from useServerFn(getFeed))
 * @outputs queryOptions with historical key/staleTime behavior
 * @pure true — factory only; fetch runs when Query executes
 */
export function feedQueryOptions(
  mode: DataMode,
  fetchLive: () => Promise<SocialFeedData>,
) {
  return queryOptions({
    queryKey: socialKeys.feed(mode),
    queryFn: (): Promise<SocialFeedData> =>
      mode === "demo" ? Promise.resolve(getMockFeed()) : fetchLive(),
    staleTime: 30_000,
  });
}

/**
 * @responsibility Build TanStack Query options for a single post permalink.
 * @inputs data mode, post id, live fetcher
 * @outputs queryOptions matching historical post key behavior
 * @pure true — factory only
 */
export function postQueryOptions(
  mode: DataMode,
  postId: string,
  fetchLive: () => Promise<SocialPostData>,
) {
  return queryOptions({
    queryKey: socialKeys.post(mode, postId),
    queryFn: (): Promise<SocialPostData> =>
      mode === "demo" ? Promise.resolve(getMockPost(postId)) : fetchLive(),
    staleTime: 30_000,
    retry: false,
  });
}
