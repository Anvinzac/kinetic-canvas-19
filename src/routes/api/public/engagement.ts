import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/engagement")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { engagementGetResponse } = await import(
          "@/features/vocabulary/api/engagement.server"
        );
        return engagementGetResponse(request);
      },
      POST: async ({ request }) => {
        const { engagementPostResponse } = await import(
          "@/features/vocabulary/api/engagement.server"
        );
        return engagementPostResponse(request);
      },
    },
  },
});
