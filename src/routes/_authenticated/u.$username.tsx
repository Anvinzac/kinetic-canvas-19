import { createFileRoute } from "@tanstack/react-router";
import { prefetchProfile } from "@/features/discovery";
import { ProfilePage } from "@/features/profile";

export const Route = createFileRoute("/_authenticated/u/$username")({
  loader: ({ context: { queryClient }, params: { username } }) =>
    prefetchProfile(queryClient, username),
  component: ProfilePage,
});
