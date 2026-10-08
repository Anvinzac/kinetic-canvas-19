import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/telemetry")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { visitorTelemetryPostResponse } =
          await import("@/features/admin/api/visitor-telemetry.server");
        return visitorTelemetryPostResponse(request);
      },
    },
  },
});
