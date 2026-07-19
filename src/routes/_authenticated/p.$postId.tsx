import { createFileRoute } from "@tanstack/react-router";
import { PostPermalinkPage, prefetchPost } from "@/features/social";

export const Route = createFileRoute("/_authenticated/p/$postId")({
  loader: ({ context: { queryClient }, params: { postId } }) =>
    prefetchPost(queryClient, postId),
  component: PostPermalinkPage,
});
