import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/word-report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { wordReportPostResponse } =
          await import("@/features/vocabulary/api/word-report.server");
        return wordReportPostResponse(request);
      },
    },
  },
});
