import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe, updateProfile } from "@/lib/discovery.functions";
import { useEffect, useState } from "react";
import { ChevronLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/edit")({
  component: EditProfile,
});

function EditProfile() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchMe = useServerFn(getMe);
  const updateFn = useServerFn(updateProfile);
  const { data } = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");

  useEffect(() => {
    if (data?.profile) {
      setDisplayName(data.profile.display_name);
      setBio(data.profile.bio ?? "");
      setAvatar(data.profile.avatar_url ?? "");
    }
  }, [data]);

  const mut = useMutation({
    mutationFn: () => updateFn({ data: { display_name: displayName, bio, avatar_url: avatar } }),
    onSuccess: () => {
      toast.success("profile updated ✨");
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      navigate({ to: "/settings" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function shuffleAvatar() {
    const seed = Math.random().toString(36).slice(2, 10);
    setAvatar(`https://i.pravatar.cc/200?u=${seed}`);
  }

  return (
    <div className="min-h-[100dvh] pb-28">
      <header className="sticky top-0 z-30 glass border-b border-white/10 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3 flex items-center gap-3">
        <button onClick={() => navigate({ to: "/settings" })} className="size-8 grid place-items-center -ml-1">
          <ChevronLeft className="size-5" />
        </button>
        <h1 className="font-impact text-xl tracking-wider flex-1">EDIT PROFILE</h1>
        <button
          onClick={() => mut.mutate()}
          disabled={mut.isPending || !displayName.trim()}
          className="grad-aurora rounded-full px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
        >
          {mut.isPending ? "saving…" : "save"}
        </button>
      </header>

      <div className="px-5 py-6 space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="grad-aurora rounded-full p-[3px]">
            <img src={avatar} alt="" className="size-28 rounded-full border-4 border-background object-cover" />
          </div>
          <button
            onClick={shuffleAvatar}
            className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 ring-1 ring-white/10 text-xs font-mono uppercase tracking-widest hover:ring-primary/60 transition"
          >
            <RefreshCw className="size-3" /> shuffle avatar
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
        <Field label="avatar url">
          <input
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            className="w-full bg-transparent font-mono text-xs outline-none"
          />
        </Field>

        {data?.profile && (
          <p className="font-mono text-[10px] text-muted-foreground">
            handle: @{data.profile.username} <span className="opacity-60">· (permanent)</span>
          </p>
        )}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10 focus-within:ring-primary/60 transition">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
        {hint && <span className="font-mono text-[10px] text-muted-foreground/60">{hint}</span>}
      </div>
      <div className="mt-1">{children}</div>
    </label>
  );
}
