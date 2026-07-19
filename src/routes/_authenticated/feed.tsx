import { createFileRoute } from "@tanstack/react-router";
import { FeedPage, prefetchFeed } from "@/features/social";

export const Route = createFileRoute("/_authenticated/feed")({
  loader: ({ context: { queryClient } }) => prefetchFeed(queryClient),
  component: FeedPage,
});
