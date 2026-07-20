import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isDemoSession } from "@/features/session";
import { MOCK_ME_USERNAME } from "@/features/demo";

// /me — resolves the signed-in user's username and redirects to /u/$username
export const Route = createFileRoute("/_authenticated/me")({
  ssr: false,
  beforeLoad: async () => {
    if (isDemoSession()) {
      throw redirect({ to: "/u/$username", params: { username: MOCK_ME_USERNAME } });
    }

    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: p } = await supabase
      .from("profiles")
      .select("username")
      .eq("auth_user_id", u.user.id)
      .maybeSingle();
    if (p?.username) throw redirect({ to: "/u/$username", params: { username: p.username } });
    throw redirect({ to: "/feed" });
  },
  component: () => null,
});
