import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProfile } from "@/lib/social.functions";
import { getMe, toggleFollow } from "@/lib/discovery.functions";
import { parseCanvas } from "@/lib/canvas";
import { Settings, Share2, UserCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/u/$username")({
  component: ProfilePage,
});

function ProfilePage() {
  const { username } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getProfile);
  const fetchMe = useServerFn(getMe);
  const followFn = useServerFn(toggleFollow);

  const { data, isLoading } = useQuery({
    queryKey: ["profile", username],
    queryFn: () => fetchProfile({ data: { username } }),
  });
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });

  const followMut = useMutation({
    mutationFn: (target_id: string) => followFn({ data: { target_id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["profile", username] });
    },
  });

  if (isLoading || !data) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <div className="grad-aurora size-12 animate-pulse rounded-full" />
      </div>
    );
  }

  const isMe = me?.profile?.id === data.profile.id;
  const isFollowing = me?.followingIds?.includes(data.profile.id) ?? false;

  async function handleShare() {
    const url = `${window.location.origin}/u/${username}`;
    try {
      if (navigator.share) await navigator.share({ title: `@${username} on Kinetic`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("link copied");
      }
    } catch {}
  }

  return (
    <div className="min-h-[100dvh] pb-28">
      <div className="grad-aurora relative h-44">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
        {isMe && (
          <button
            onClick={() => navigate({ to: "/settings" })}
            className="absolute right-4 top-[max(env(safe-area-inset-top),12px)] grid size-9 place-items-center rounded-full bg-black/40 backdrop-blur"
            aria-label="Settings"
          >
            <Settings className="size-4 text-white" />
          </button>
        )}
        <button
          onClick={handleShare}
          className={`absolute ${isMe ? "right-16" : "right-4"} top-[max(env(safe-area-inset-top),12px)] grid size-9 place-items-center rounded-full bg-black/40 backdrop-blur`}
          aria-label="Share"
        >
          <Share2 className="size-4 text-white" />
        </button>
      </div>

      <div className="-mt-16 px-5">
        <div className="grad-aurora inline-block rounded-full p-[3px]">
          <img src={data.profile.avatar_url ?? ""} alt="" className="size-24 rounded-full border-4 border-background" />
        </div>
        <h1 className="mt-3 font-display text-2xl font-black">{data.profile.display_name}</h1>
        <p className="font-mono text-xs text-muted-foreground">@{data.profile.username}</p>
        {data.profile.bio && <p className="mt-2 text-sm leading-relaxed">{data.profile.bio}</p>}

        <div className="mt-4 flex gap-6 font-mono text-xs uppercase tracking-widest">
          <Stat n={data.posts.length} label="posts" />
          <Stat n={data.followers} label="followers" />
          <Stat n={data.following} label="following" />
        </div>

        <div className="mt-5 flex gap-2">
          {isMe ? (
            <Link
              to="/edit-profile"
              className="flex-1 rounded-full bg-white/10 py-2.5 text-center text-sm font-bold ring-1 ring-white/10 hover:bg-white/15 transition"
            >
              edit profile
            </Link>
          ) : (
            <button
              onClick={() => followMut.mutate(data.profile.id)}
              disabled={followMut.isPending}
              className={`flex-1 flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold transition ${
                isFollowing
                  ? "bg-white/10 ring-1 ring-white/10 hover:bg-white/15"
                  : "grad-aurora text-white shadow-[var(--shadow-glow)]"
              }`}
            >
              {isFollowing ? <UserCheck className="size-4" /> : <UserPlus className="size-4" />}
              {isFollowing ? "following" : "follow"}
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 px-1">
        <div className="px-4 mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {data.posts.length} kinetic{data.posts.length === 1 ? "" : "s"}
        </div>
        <div className="grid grid-cols-3 gap-1">
          {data.posts.map((p) => {
            const spec = parseCanvas(p.canvas_html);
            return (
              <div
                key={p.id}
                className="relative aspect-[3/4] overflow-hidden rounded-md group"
                style={{ background: p.bg_gradient ?? "#111" }}
              >
                {p.media_urls?.[0] && (
                  <img src={p.media_urls[0]} alt="" className="absolute inset-0 size-full object-cover opacity-90" />
                )}
                <div
                  className="absolute inset-0 flex items-center justify-center p-2 text-center"
                  style={{ fontFamily: spec.font, color: spec.color, fontWeight: spec.weight }}
                >
                  <span className="line-clamp-3 text-[11px] font-bold drop-shadow">{spec.text}</span>
                </div>
              </div>
            );
          })}
        </div>
        {data.posts.length === 0 && (
          <p className="py-16 text-center font-mono text-xs text-muted-foreground">no kinetics yet</p>
        )}
      </div>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div className="font-display text-xl font-black normal-case tracking-normal">{n}</div>
      <div className="text-muted-foreground">{label}</div>
    </div>
  );
}
