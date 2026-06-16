import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      navigate({ to: data.user ? "/feed" : "/auth", replace: true });
    });
  }, [navigate]);
  return (
    <div className="flex h-[100dvh] items-center justify-center bg-background">
      <div className="grad-aurora size-14 animate-pulse rounded-full" />
    </div>
  );
}
