/**
 * Persist client errors into admin telemetry (demo store + optional live serverFn).
 *
 * Exports: reportLovableError (re-export wrapper used by shell)
 * Depends on: emit, session demo detection
 */

type LovableErrorOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

type LovableEvents = {
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: LovableErrorOptions,
  ) => void;
};

declare global {
  interface Window {
    __lovableEvents?: LovableEvents;
  }
}

function messageFromError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Report a client/React error to Lovable sink and admin telemetry.
 * @param error - thrown value
 * @param context - extra metadata
 * @returns void
 */
export function reportLovableError(error: unknown, context: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;

  window.__lovableEvents?.captureException?.(
    error,
    {
      source: "react_error_boundary",
      route: window.location.pathname,
      ...context,
    },
    {
      mechanism: "react_error_boundary",
      handled: false,
      severity: "error",
    },
  );

  const message = messageFromError(error);
  void import("@/features/admin/lib/emit").then(async ({ emitTelemetryEvent }) => {
    const { isDemoSession, DEMO_AUTH_USER_ID } = await import("@/features/session/demo-session");
    const demo = isDemoSession();
    if (demo) {
      await emitTelemetryEvent({
        mode: "demo",
        event_type: "error.reported",
        actor_user_id: DEMO_AUTH_USER_ID,
        entity_type: "client",
        severity: "error",
        asErrorReport: true,
        errorMessage: message,
        metadata: {
          message,
          route: window.location.pathname,
          ...context,
        },
      });
      return;
    }

    try {
      const { reportAdminError } = await import("@/features/admin/api/error-status.functions");
      await reportAdminError({
        data: {
          message,
          metadata: {
            route: window.location.pathname,
            boundary: String(context.boundary ?? ""),
          },
          severity: "error",
        },
      });
    } catch {
      // Best-effort when unauthenticated / offline.
    }
  });
}
