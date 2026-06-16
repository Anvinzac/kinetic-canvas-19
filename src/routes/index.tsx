import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    import("@/integrations/supabase/client").then(async ({ supabase }) => {
      const { data } = await supabase.auth.getUser();
      navigate({ to: data.user ? "/feed" : "/auth", replace: true });
    });
  }, [navigate]);
  return (
    <div className="flex h-[100dvh] items-center justify-center bg-background">
      <div className="grad-aurora size-14 animate-pulse rounded-full" />
    </div>
  );
}
