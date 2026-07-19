import { useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type ReactNode } from "react";
import { Camera, Check, ChevronLeft, Link2, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { discoveryKeys, getMe, meQueryOptions, updateProfile } from "@/features/discovery";
import { resolveDataMode } from "@/features/session";
import { updateMockProfile } from "@/lib/mock-data";
import type { SocialMeData } from "@/shared/types";
import { getProfileCompletion } from "../lib/stats";

const BIO_STARTERS = [
  "kinetic typography and fast ideas",
  "posting motion sketches in public",
  "words, rhythm, loops, repeat",
  "building a tiny archive of moving thoughts",
];

export function EditProfilePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchMe = useServerFn(getMe);
  const updateFn = useServerFn(updateProfile);
  const dataMode = resolveDataMode();
  const demoMode = dataMode === "demo";
  const { data } = useQuery(meQueryOptions(dataMode, () => fetchMe() as Promise<SocialMeData>));

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    if (data?.profile) {
      setDisplayName(data.profile.display_name);
      setBio(data.profile.bio ?? "");
      setAvatar(data.profile.avatar_url ?? "");
    }
  }, [data]);

  useEffect(() => {
    setAvatarError(false);
  }, [avatar]);

  const cleanAvatar = avatar.trim();
  const validAvatar = !cleanAvatar || isValidUrl(cleanAvatar);
  const profileCompletion = getProfileCompletion({
    displayName,
    bio,
    avatar: cleanAvatar || null,
    posts: data?.stats.posts ?? 0,
  });

  const mut = useMutation({
    mutationFn: () => {
      if (!displayName.trim()) throw new Error("display name is required");
      if (!validAvatar) throw new Error("avatar url is invalid");
      if (demoMode) {
        return updateMockProfile({
          display_name: displayName.trim(),
          bio: bio.trim(),
          avatar_url: cleanAvatar || null,
        });
      }
      return updateFn({
        data: {
          display_name: displayName.trim(),
          bio: bio.trim(),
          ...(cleanAvatar ? { avatar_url: cleanAvatar } : {}),
        },
      });
    },
    onSuccess: () => {
      toast.success("profile updated ✨");
      qc.invalidateQueries({ queryKey: discoveryKeys.meRoot });
      qc.invalidateQueries({ queryKey: discoveryKeys.profileRoot });
      navigate({ to: "/settings" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function shuffleAvatar() {
    const seed = Math.random().toString(36).slice(2, 10);
    setAvatar(`https://i.pravatar.cc/240?u=${seed}`);
  }

  const previewAvatar =
    cleanAvatar || `https://i.pravatar.cc/240?u=${data?.profile?.username ?? "kinetic"}`;
  const canSave = !!displayName.trim() && validAvatar && !mut.isPending;

  return (
    <div className="min-h-[100dvh] pb-8">
      <header className="sticky top-0 z-30 glass flex items-center gap-3 border-b border-white/10 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3">
        <button
          onClick={() => navigate({ to: "/settings" })}
          className="-ml-1 grid size-8 place-items-center"
          aria-label="Back"
        >
          <ChevronLeft className="size-5" />
        </button>
        <h1 className="font-impact text-xl tracking-wider flex-1">EDIT PROFILE</h1>
        <button
          onClick={() => mut.mutate()}
          disabled={!canSave}
          className="grad-aurora flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
        >
          <Check className="size-3.5" />
          {mut.isPending ? "saving" : "save"}
        </button>
      </header>

      <div className="px-5 py-6 space-y-6">
        <section className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <div className="grad-aurora rounded-full p-[3px]">
                <img
                  src={
                    avatarError
                      ? `https://i.pravatar.cc/240?u=${data?.profile?.username ?? "kinetic"}`
                      : previewAvatar
                  }
                  alt=""
                  onError={() => setAvatarError(true)}
                  className="size-24 rounded-full border-4 border-background object-cover"
                />
              </div>
              <span className="absolute bottom-0 right-0 grid size-8 place-items-center rounded-full bg-white text-black ring-4 ring-background">
                <Camera className="size-4" />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-display text-2xl font-black">
                {displayName.trim() || "Display name"}
              </h2>
              <p className="font-mono text-xs text-muted-foreground">
                @{data?.profile?.username ?? "username"}
              </p>
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-foreground/85">
                {bio.trim() || "Add a short bio for your profile."}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                profile signal
              </span>
              <span className="font-mono text-xs text-muted-foreground">{profileCompletion}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${profileCompletion}%` }}
              />
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={shuffleAvatar}
            className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-2 text-xs font-mono uppercase tracking-widest ring-1 ring-white/10 transition hover:ring-primary/60"
          >
            <RefreshCw className="size-3" /> shuffle avatar
          </button>
          <button
            onClick={() => setAvatar(data?.profile?.avatar_url ?? "")}
            className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-2 text-xs font-mono uppercase tracking-widest ring-1 ring-white/10 transition hover:ring-primary/60"
          >
            <Sparkles className="size-3" /> restore
          </button>
        </div>

        <Field label="display name" hint={`${displayName.length}/60`}>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value.slice(0, 60))}
            className="w-full bg-transparent text-base font-display font-bold outline-none"
          />
        </Field>

        <Field label="bio" hint={`${bio.length}/280`}>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 280))}
            rows={4}
            placeholder="what kinetic energy do you bring?"
            className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </Field>

        <div>
          <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <Wand2 className="size-3" />
            bio starters
          </div>
          <div className="flex flex-wrap gap-2">
            {BIO_STARTERS.map((starter) => (
              <button
                key={starter}
                type="button"
                onClick={() => setBio(starter.slice(0, 280))}
                className="rounded-full bg-white/5 px-3 py-2 text-xs ring-1 ring-white/10 transition hover:ring-primary/60"
              >
                {starter}
              </button>
            ))}
          </div>
        </div>

        <Field
          label="avatar url"
          hint={validAvatar ? "https" : "invalid"}
          invalid={!validAvatar || avatarError}
          icon={<Link2 className="size-3" />}
        >
          <input
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            placeholder="https://"
            className="w-full bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground"
          />
        </Field>

        {data?.profile && (
          <p className="font-mono text-[10px] text-muted-foreground">
            handle: @{data.profile.username} <span className="opacity-60">· permanent</span>
          </p>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  icon,
  invalid,
  children,
}: {
  label: string;
  hint?: string;
  icon?: ReactNode;
  invalid?: boolean;
  children: ReactNode;
}) {
  return (
    <label
      className={`block rounded-2xl bg-white/5 px-4 py-3 ring-1 transition focus-within:ring-primary/60 ${
        invalid ? "ring-destructive/70" : "ring-white/10"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {icon}
          {label}
        </span>
        {hint && (
          <span
            className={`font-mono text-[10px] ${invalid ? "text-destructive" : "text-muted-foreground/60"}`}
          >
            {hint}
          </span>
        )}
      </div>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
