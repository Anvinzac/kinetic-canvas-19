/**
 * Admin layout route — requires demo admin flag or live is_admin.
 */

import { createFileRoute, redirect } from "@tanstack/react-router";
import { AdminShell, isDemoAdminEnabled } from "@/features/admin";
import { checkLiveAdminAccess } from "@/features/admin/api/error-status.functions";
import { adminSearchSchema } from "@/features/admin/lib/search-schema";
import { getDemoRouteUser, isDemoSession } from "@/features/session";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  ssr: false,
  validateSearch: (search) => adminSearchSchema.parse(search),
  beforeLoad: async () => {
    if (isDemoSession()) {
      if (!isDemoAdminEnabled()) {
        throw redirect({ to: "/admin-access-denied" });
      }
      return { user: getDemoRouteUser(), adminMode: "demo" as const };
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    const access = await checkLiveAdminAccess();
    if (!access.ok) throw redirect({ to: "/admin-access-denied" });

    return { user: data.user, adminMode: "live" as const };
  },
  component: AdminShell,
});
