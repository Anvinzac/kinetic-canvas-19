/**
 * Root HTML shell and React Query / auth wiring for the app document.
 *
 * Exports: RootShell, RootApp
 * Depends on: @tanstack/react-query, @tanstack/react-router, sonner
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, useRouter, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

/**
 * HTML document shell that hosts head content, body children, and scripts.
 * @param props.children - Route tree content
 * @returns html/head/body document frame
 */
export function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/**
 * Root app providers: React Query, auth invalidation, toast host.
 * @param props.queryClient - Shared QueryClient from router context
 * @returns Provider-wrapped outlet tree
 */
export function RootApp({ queryClient }: { queryClient: QueryClient }) {
  const router = useRouter();

  useEffect(() => {
    let unsub: { unsubscribe?: () => void } | undefined;
    import("@/integrations/supabase/client").then(({ supabase }) => {
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
        router.invalidate();
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      });
      unsub = data.subscription;
    });
    return () => unsub?.unsubscribe?.();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster position="top-center" theme="dark" richColors />
    </QueryClientProvider>
  );
}
