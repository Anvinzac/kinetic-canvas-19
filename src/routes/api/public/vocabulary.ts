import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/vocabulary")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { vocabularyResponse } = await import("@/features/vocabulary/api/endpoint.server");
        return vocabularyResponse(request);
      },
    },
  },
});
