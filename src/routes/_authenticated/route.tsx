import { useQueryClient } from "@tanstack/react-query";
import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { endDemoSession, getDemoRouteUser, isDemoSession } from "@/lib/demo-session";
import {
  Bell,
  Home,
  Info,
  LogOut,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  User,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (isDemoSession()) return { user: getDemoRouteUser() };

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const demoMode = isDemoSession();
  const showShellMenu =
    !pathname.startsWith("/feed") &&
    !pathname.startsWith("/create") &&
    !pathname.startsWith("/p/") &&
    !pathname.startsWith("/u/");

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    if (demoMode) endDemoSession();
    else await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <Outlet />
      {showShellMenu && (
        <div className="fixed right-3 top-[max(env(safe-area-inset-top),12px)] z-[80] flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="grid size-10 place-items-center rounded-full bg-black/45 text-white shadow-[0_12px_34px_rgba(0,0,0,0.28)] ring-1 ring-white/15 backdrop-blur transition active:scale-95"
            aria-label="Open navigation"
            aria-expanded={menuOpen}
          >
            <MoreHorizontal className="size-5" />
          </button>

          {menuOpen && (
            <div className="w-48 overflow-hidden rounded-2xl bg-black/70 p-1.5 text-white shadow-[0_18px_55px_rgba(0,0,0,0.42)] ring-1 ring-white/10 backdrop-blur-xl">
              <MenuLink to="/create" icon={<Plus className="size-4" />} label="Create" />
              <MenuLink to="/feed" icon={<Home className="size-4" />} label="Feed" />
              <MenuLink to="/discover" icon={<Search className="size-4" />} label="Discover" />
              <MenuLink to="/notifications" icon={<Bell className="size-4" />} label="Activity" />
              <MenuLink to="/me" icon={<User className="size-4" />} label="Profile" />
              <MenuLink to="/settings" icon={<Settings className="size-4" />} label="Settings" />
              <MenuLink to="/about" icon={<Info className="size-4" />} label="About" />
              <button
                type="button"
                onClick={handleSignOut}
                className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MenuLink({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white"
      activeProps={{ className: "bg-white/10 text-white" }}
    >
      {icon}
      {label}
    </Link>
  );
}
