import { createFileRoute } from "@tanstack/react-router";
import { DiscoverPage, prefetchDiscover } from "@/features/discovery";

export const Route = createFileRoute("/_authenticated/discover")({
  loader: ({ context: { queryClient } }) => prefetchDiscover(queryClient),
  component: DiscoverPage,
});
