import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Home, Plus, User } from "lucide-react";

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
      <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/10 px-6 py-3 pb-[max(env(safe-area-inset-bottom),12px)]">
        <div className="mx-auto flex max-w-md items-center justify-around">
          <NavBtn to="/feed" icon={<Home className="size-6" />} label="Feed" />
          <NavBtn to="/create" icon={<Plus className="size-7" />} label="Create" emphasized />
          <NavBtn to="/me" icon={<User className="size-6" />} label="Me" />
        </div>
      </nav>
    </div>
  );
}

function NavBtn({ to, icon, label, emphasized }: { to: string; icon: React.ReactNode; label: string; emphasized?: boolean }) {
  return (
    <Link
      to={to}
      className="group flex flex-col items-center gap-1"
      activeProps={{ className: "text-primary" }}
    >
      <span
        className={
          emphasized
            ? "grad-aurora rounded-full p-3 text-white shadow-[var(--shadow-glow)]"
            : "text-muted-foreground group-hover:text-foreground transition"
        }
      >
        {icon}
      </span>
      {!emphasized && <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>}
    </Link>
  );
}
