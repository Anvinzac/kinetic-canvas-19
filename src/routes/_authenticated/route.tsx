import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Home, Plus, User, Search, Bell } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <Outlet />
      <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/10 px-4 py-2.5 pb-[max(env(safe-area-inset-bottom),10px)]">
        <div className="mx-auto flex max-w-md items-center justify-around">
          <NavBtn to="/feed" icon={<Home className="size-5" />} label="Feed" />
          <NavBtn to="/discover" icon={<Search className="size-5" />} label="Search" />
          <NavBtn to="/create" icon={<Plus className="size-6" />} label="Create" emphasized />
          <NavBtn to="/notifications" icon={<Bell className="size-5" />} label="Alerts" />
          <NavBtn to="/me" icon={<User className="size-5" />} label="Me" />
        </div>
      </nav>
    </div>
  );
}

function NavBtn({ to, icon, label, emphasized }: { to: string; icon: React.ReactNode; label: string; emphasized?: boolean }) {
  return (
    <Link
      to={to}
      className="group flex flex-col items-center gap-0.5"
      activeProps={{ className: "text-primary" }}
    >
      <span
        className={
          emphasized
            ? "grad-aurora rounded-full p-2.5 text-white shadow-[var(--shadow-glow)]"
            : "text-muted-foreground group-hover:text-foreground transition group-[.text-primary]:text-primary"
        }
      >
        {icon}
      </span>
      {!emphasized && <span className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</span>}
    </Link>
  );
}
