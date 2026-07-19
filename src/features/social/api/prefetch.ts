import type { QueryClient } from "@tanstack/react-query";
import { resolveDataMode } from "@/features/session";
import { getMockFeed, getMockPost } from "@/features/demo";
import type { SocialFeedData, SocialPostData } from "@/shared/types";
import { feedQueryOptions, postQueryOptions } from "./queries";
import { getFeed, getPost } from "./social.functions";

/**
 * @responsibility Prefetch the feed into the QueryClient for route loaders.
 * @inputs queryClient
 * @outputs Resolved feed data (cached under socialKeys.feed)
 * @sideEffects Populates React Query cache; may call live serverFn or demo store
 */
export async function prefetchFeed(queryClient: QueryClient) {
  const mode = resolveDataMode();
  return queryClient.ensureQueryData(
    feedQueryOptions(mode, () =>
      mode === "demo"
        ? Promise.resolve(getMockFeed())
        : (getFeed() as Promise<SocialFeedData>),
    ),
  );
}

/**
 * @responsibility Prefetch a single post into the QueryClient for route loaders.
 * @inputs queryClient, postId
 * @outputs Resolved post graph
 * @sideEffects Populates React Query cache
 */
export async function prefetchPost(queryClient: QueryClient, postId: string) {
  const mode = resolveDataMode();
  return queryClient.ensureQueryData(
    postQueryOptions(mode, postId, () =>
      mode === "demo"
        ? Promise.resolve(getMockPost(postId))
        : (getPost({ data: { post_id: postId } }) as Promise<SocialPostData>),
    ),
  );
}
