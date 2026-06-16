import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe } from "@/lib/discovery.functions";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, Edit3, LogOut, Bell, Lock, HelpCircle, Sparkles, Palette } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchMe = useServerFn(getMe);
  const { data } = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });
  const [pushOn, setPushOn] = useState(true);
  const [privateAcc, setPrivateAcc] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-[100dvh] pb-28">
      <header className="sticky top-0 z-30 glass border-b border-white/10 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3">
        <h1 className="font-impact text-2xl tracking-wider">SETTINGS</h1>
      </header>

      <div className="px-4 py-5 space-y-5">
        {data?.profile && (
          <Link
            to="/settings/edit"
            className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 p-4 ring-1 ring-white/10 hover:ring-primary/60 transition"
          >
            <img src={data.profile.avatar_url ?? ""} alt="" className="size-14 rounded-full" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-display font-bold">{data.profile.display_name}</div>
              <div className="truncate font-mono text-xs text-muted-foreground">@{data.profile.username}</div>
            </div>
            <Edit3 className="size-4 text-muted-foreground" />
          </Link>
        )}

        <Section title="account">
          <Row icon={<Edit3 />} label="edit profile" to="/edit-profile" />
          <Row icon={<Lock />} label="private account" toggle value={privateAcc} onToggle={setPrivateAcc} />
        </Section>

        <Section title="experience">
          <Row icon={<Bell />} label="push notifications" toggle value={pushOn} onToggle={setPushOn} />
          <Row icon={<Sparkles />} label="reduced motion" toggle value={reducedMotion} onToggle={setReducedMotion} />
          <Row
            icon={<Palette />}
            label="appearance"
            value="dark · aurora"
            onClick={() => toast("more themes dropping soon ✨")}
          />
        </Section>

        <Section title="support">
          <Row icon={<HelpCircle />} label="help & feedback" onClick={() => toast("hello@kinetic.app")} />
        </Section>

        <button
          onClick={handleSignOut}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-destructive/15 py-3.5 font-mono text-xs uppercase tracking-[0.2em] text-destructive ring-1 ring-destructive/30 hover:bg-destructive/25 transition"
        >
          <LogOut className="size-4" /> sign out
        </button>

        <p className="pt-2 text-center font-mono text-[10px] text-muted-foreground/50">
          kinetic · v0.1 · made for moving words
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{title}</h2>
      <div className="overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10 divide-y divide-white/5">
        {children}
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  to,
  onClick,
  toggle,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  value?: React.ReactNode;
  to?: string;
  onClick?: () => void;
  toggle?: boolean;
  onToggle?: (v: boolean) => void;
}) {
  const content = (
    <>
      <span className="grid size-8 place-items-center rounded-lg bg-white/5 text-muted-foreground [&_svg]:size-4">
        {icon}
      </span>
      <span className="flex-1 text-sm">{label}</span>
      {toggle ? (
        <button
          onClick={(e) => {
            e.preventDefault();
            onToggle?.(!value);
          }}
          className={`relative h-6 w-11 rounded-full transition ${value ? "grad-aurora" : "bg-white/10"}`}
          aria-pressed={!!value}
        >
          <span
            className={`absolute top-0.5 size-5 rounded-full bg-white transition ${value ? "left-[22px]" : "left-0.5"}`}
          />
        </button>
      ) : (
        <>
          {value && <span className="font-mono text-xs text-muted-foreground">{value}</span>}
          <ChevronRight className="size-4 text-muted-foreground/60" />
        </>
      )}
    </>
  );
  const cls = "flex items-center gap-3 px-3.5 py-3 hover:bg-white/5 transition";
  if (to) return <Link to={to} className={cls}>{content}</Link>;
  return <button type="button" onClick={onClick} className={`${cls} w-full text-left`}>{content}</button>;
}
