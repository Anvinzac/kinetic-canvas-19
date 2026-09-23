import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: ({ location }) => {
    // Keep OAuth callback parameters while sending every visitor to the public feed.
    throw redirect({ to: "/feed", search: location.search, hash: location.hash, replace: true });
  },
});
