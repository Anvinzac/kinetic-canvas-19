import { createFileRoute, redirect } from "@tanstack/react-router";
import { sitePageHead } from "@/features/vocabulary/lib/target-language";

export const Route = createFileRoute("/")({
  head: () => sitePageHead(),
  beforeLoad: ({ location }) => {
    // Keep OAuth callback parameters while sending every visitor to the public feed.
    throw redirect({ to: "/feed", search: location.search, hash: location.hash, replace: true });
  },
});
