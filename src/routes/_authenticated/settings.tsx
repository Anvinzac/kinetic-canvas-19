import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe } from "@/lib/discovery.functions";
import { supabase } from "@/integrations/supabase/client";
import { endDemoSession, isDemoSession } from "@/lib/demo-session";
import { getMockMe, type MockMeData } from "@/lib/mock-data";
import { Switch } from "@/components/ui/switch";
import {
  AtSign,
  Bell,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Edit3,
  EyeOff,
  Gauge,
  Globe2,
  HelpCircle,
  Info,
  Image as ImageIcon,
  Lock,
  LogOut,
  MessageCircleOff,
  MoonStar,
  Palette,
  RefreshCw,
  Shield,
  Sparkles,
  Type,
  UserCircle,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState, type ReactNode } from "react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

type Preferences = {
  pushOn: boolean;
  privateAccount: boolean;
  reducedMotion: boolean;
  dataSaver: boolean;
  autoplayPreviews: boolean;
  reactionHints: boolean;
  commentFilter: boolean;
  weeklyDigest: boolean;
  audience: "public" | "followers" | "private";
  defaultFormat: "text" | "image" | "video";
};

const PREF_KEY = "kinetic.settings.preferences";
const DEFAULT_PREFS: Preferences = {
  pushOn: true,
  privateAccount: false,
  reducedMotion: false,
  dataSaver: false,
  autoplayPreviews: true,
  reactionHints: true,
  commentFilter: false,
  weeklyDigest: true,
  audience: "public",
  defaultFormat: "text",
};

function SettingsPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();

  function handleBack() {
    if (router.history.length > 1) router.history.back();
    else navigate({ to: "/feed" });
  }

  const fetchMe = useServerFn(getMe);
  const demoMode = isDemoSession();
  const { data } = useQuery<MockMeData>({
    queryKey: ["me", demoMode ? "demo" : "live"],
    queryFn: () => (demoMode ? getMockMe() : (fetchMe() as Promise<MockMeData>)),
  });
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPrefs(readPreferences());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  }, [hydrated, prefs]);

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    if (demoMode) endDemoSession();
    else await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function copyProfileLink() {
    if (!data?.profile) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/u/${data.profile.username}`);
      toast.success("profile link copied");
    } catch {
      toast.error("could not copy link");
    }
  }

  function resetPreferences() {
    setPrefs(DEFAULT_PREFS);
    toast.success("settings reset");
  }

  const profile = data?.profile;
  const completion = profile
    ? getProfileCompletion({
        displayName: profile.display_name,
        bio: profile.bio ?? null,
        avatar: profile.avatar_url,
        posts: data.stats.posts,
      })
    : 0;

  return (
    <div className="min-h-[100dvh] pb-8">
      <header className="sticky top-0 z-30 glass flex items-center justify-between border-b border-white/10 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="-ml-1 grid size-8 place-items-center"
            aria-label="Back"
          >
            <ChevronLeft className="size-5" />
          </button>
          <h1 className="font-impact text-2xl tracking-wider">SETTINGS</h1>
        </div>
        <button
          type="button"
          onClick={resetPreferences}
          className="grid size-9 place-items-center rounded-full bg-white/5 text-muted-foreground ring-1 ring-white/10 transition hover:text-foreground"
          aria-label="Reset settings"
        >
          <RefreshCw className="size-4" />
        </button>
      </header>

      <div className="px-4 py-5 space-y-5">
        {profile && (
          <section className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 p-4 ring-1 ring-white/10">
            <div className="flex items-center gap-3">
              <Link
                to="/u/$username"
                params={{ username: profile.username }}
                className="grad-aurora rounded-full p-[2px]"
              >
                <img
                  src={profile.avatar_url ?? ""}
                  alt=""
                  className="size-16 rounded-full border-2 border-background object-cover"
                />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-lg font-bold">
                  {profile.display_name}
                </div>
                <div className="truncate font-mono text-xs text-muted-foreground">
                  @{profile.username}
                </div>
                <div className="mt-2 flex gap-4 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  <span>{formatCount(data.stats.posts)} posts</span>
                  <span>{formatCount(data.stats.followers)} followers</span>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  profile signal
                </span>
                <span className="font-mono text-xs text-muted-foreground">{completion}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${completion}%` }}
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link
                to="/edit-profile"
                className="flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-black transition hover:bg-white/90"
              >
                <Edit3 className="size-4" />
                edit
              </Link>
              <button
                type="button"
                onClick={copyProfileLink}
                className="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-bold ring-1 ring-white/10 transition hover:bg-white/15"
              >
                <Copy className="size-4" />
                copy
              </button>
            </div>
          </section>
        )}

        <Section title="account">
          <Row icon={<Edit3 />} label="edit profile" to="/edit-profile" value={`${completion}%`} />
          {profile && (
            <Row
              icon={<AtSign />}
              label="public profile"
              value={`@${profile.username}`}
              onClick={() =>
                navigate({ to: "/u/$username", params: { username: profile.username } })
              }
            />
          )}
          <PreferenceRow
            icon={<Lock />}
            label="private account"
            checked={prefs.privateAccount}
            onCheckedChange={(privateAccount) => setPrefs((p) => ({ ...p, privateAccount }))}
          />
          <ControlRow icon={<Globe2 />} label="default audience">
            <SegmentedControl
              value={prefs.audience}
              onChange={(audience) =>
                setPrefs((p) => ({ ...p, audience: audience as Preferences["audience"] }))
              }
              options={[
                { value: "public", label: "public" },
                { value: "followers", label: "followers" },
                { value: "private", label: "private" },
              ]}
            />
          </ControlRow>
        </Section>

        <Section title="creator defaults">
          <ControlRow icon={<Type />} label="post format">
            <SegmentedControl
              value={prefs.defaultFormat}
              onChange={(defaultFormat) =>
                setPrefs((p) => ({
                  ...p,
                  defaultFormat: defaultFormat as Preferences["defaultFormat"],
                }))
              }
              options={[
                { value: "text", label: "text", icon: <Type className="size-3" /> },
                { value: "image", label: "image", icon: <ImageIcon className="size-3" /> },
                { value: "video", label: "video", icon: <Video className="size-3" /> },
              ]}
            />
          </ControlRow>
          <PreferenceRow
            icon={<Sparkles />}
            label="reaction hints"
            checked={prefs.reactionHints}
            onCheckedChange={(reactionHints) => setPrefs((p) => ({ ...p, reactionHints }))}
          />
          <PreferenceRow
            icon={<Gauge />}
            label="autoplay previews"
            checked={prefs.autoplayPreviews}
            onCheckedChange={(autoplayPreviews) => setPrefs((p) => ({ ...p, autoplayPreviews }))}
          />
          <PreferenceRow
            icon={<EyeOff />}
            label="data saver"
            checked={prefs.dataSaver}
            onCheckedChange={(dataSaver) => setPrefs((p) => ({ ...p, dataSaver }))}
          />
        </Section>

        <Section title="experience">
          <PreferenceRow
            icon={<Bell />}
            label="push notifications"
            checked={prefs.pushOn}
            onCheckedChange={(pushOn) => setPrefs((p) => ({ ...p, pushOn }))}
          />
          <PreferenceRow
            icon={<MessageCircleOff />}
            label="comment filter"
            checked={prefs.commentFilter}
            onCheckedChange={(commentFilter) => setPrefs((p) => ({ ...p, commentFilter }))}
          />
          <PreferenceRow
            icon={<MoonStar />}
            label="reduced motion"
            checked={prefs.reducedMotion}
            onCheckedChange={(reducedMotion) => setPrefs((p) => ({ ...p, reducedMotion }))}
          />
          <Row
            icon={<Palette />}
            label="appearance"
            value="dark"
            onClick={() => toast("dark mode active")}
          />
        </Section>

        <Section title="privacy & support">
          <PreferenceRow
            icon={<Shield />}
            label="weekly digest"
            checked={prefs.weeklyDigest}
            onCheckedChange={(weeklyDigest) => setPrefs((p) => ({ ...p, weeklyDigest }))}
          />
          <Row
            icon={<UserCircle />}
            label="blocked accounts"
            value="0"
            onClick={() => toast("no blocked accounts")}
          />
          <Row
            icon={<Download />}
            label="download archive"
            onClick={() => toast("archive request queued")}
          />
          <Row icon={<Info />} label="about kinetic" to="/about" />
          <Row
            icon={<HelpCircle />}
            label="help & feedback"
            onClick={() => {
              window.location.href = "mailto:hello@kinetic.app";
            }}
          />
        </Section>

        <button
          onClick={handleSignOut}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-destructive/15 py-3.5 font-mono text-xs uppercase tracking-[0.2em] text-destructive ring-1 ring-destructive/30 transition hover:bg-destructive/25"
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </h2>
      <div className="overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10 divide-y divide-white/5">
        {children}
      </div>
    </section>
  );
}

function Row({
  icon,
  label,
  value,
  to,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value?: ReactNode;
  to?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <IconSlot>{icon}</IconSlot>
      <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
      {value && (
        <span className="max-w-[42%] truncate font-mono text-xs text-muted-foreground">
          {value}
        </span>
      )}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
    </>
  );
  const cls = "flex items-center gap-3 px-3.5 py-3 transition hover:bg-white/5";
  if (to)
    return (
      <Link to={to} className={cls}>
        {content}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className={`${cls} w-full text-left`}>
      {content}
    </button>
  );
}

function PreferenceRow({
  icon,
  label,
  checked,
  onCheckedChange,
}: {
  icon: ReactNode;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-3">
      <IconSlot>{icon}</IconSlot>
      <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </div>
  );
}

function ControlRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="px-3.5 py-3">
      <div className="mb-3 flex items-center gap-3">
        <IconSlot>{icon}</IconSlot>
        <span className="text-sm">{label}</span>
      </div>
      {children}
    </div>
  );
}

function IconSlot({ children }: { children: ReactNode }) {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/5 text-muted-foreground [&_svg]:size-4">
      {children}
    </span>
  );
}

function SegmentedControl({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string; icon?: ReactNode }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl bg-black/20 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-bold transition ${
            value === option.value
              ? "bg-white text-black"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {option.icon}
          <span className="truncate">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

function readPreferences() {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const stored = window.localStorage.getItem(PREF_KEY);
    if (!stored) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(stored) } as Preferences;
  } catch {
    return DEFAULT_PREFS;
  }
}

function getProfileCompletion({
  displayName,
  bio,
  avatar,
  posts,
}: {
  displayName: string;
  bio: string | null;
  avatar: string | null;
  posts: number;
}) {
  const checks = [displayName.trim().length > 0, !!bio?.trim(), !!avatar, posts > 0];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function formatCount(n: number) {
  return new Intl.NumberFormat("en", { notation: n > 999 ? "compact" : "standard" }).format(n);
}
