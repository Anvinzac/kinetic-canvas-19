import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode } from "react";
import { getProfile } from "@/lib/social.functions";
import { getMe, toggleFollow } from "@/lib/discovery.functions";
import { parseCanvas } from "@/lib/canvas";
import { isDemoSession } from "@/lib/demo-session";
import {
  getMockMe,
  getMockProfile,
  toggleMockFollow,
  type MockMeData,
  type MockProfileData,
} from "@/lib/mock-data";
import {
  CalendarDays,
  Clapperboard,
  Grid3X3,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  Newspaper,
  Radio,
  Settings,
  Share2,
  Sparkles,
  Type,
  UserCheck,
  UserPlus,
  Video,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/u/$username")({
  component: ProfilePage,
});

type PostKind = "text" | "image" | "video" | "slideshow" | "link";
type PostFilter = "all" | PostKind;
type Engagement = { likes: number; comments: number };
type ProfilePost = {
  id: string;
  post_type: string;
  canvas_html: string;
  media_urls: string[] | null;
  bg_gradient: string | null;
  created_at: string;
};

const FILTERS: { id: PostFilter; label: string; icon: ReactNode }[] = [
  { id: "all", label: "all", icon: <Grid3X3 className="size-3.5" /> },
  { id: "text", label: "text", icon: <Type className="size-3.5" /> },
  { id: "image", label: "image", icon: <ImageIcon className="size-3.5" /> },
  { id: "video", label: "video", icon: <Video className="size-3.5" /> },
  { id: "slideshow", label: "slides", icon: <Clapperboard className="size-3.5" /> },
  { id: "link", label: "links", icon: <Newspaper className="size-3.5" /> },
];

const POST_KINDS: PostKind[] = ["text", "image", "video", "slideshow", "link"];

function ProfilePage() {
  const { username } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getProfile);
  const fetchMe = useServerFn(getMe);
  const followFn = useServerFn(toggleFollow);
  const [filter, setFilter] = useState<PostFilter>("all");
  const demoMode = isDemoSession();

  const { data, isLoading } = useQuery<MockProfileData>({
    queryKey: ["profile", username, demoMode ? "demo" : "live"],
    queryFn: () =>
      demoMode
        ? getMockProfile(username)
        : (fetchProfile({ data: { username } }) as Promise<MockProfileData>),
  });
  const { data: me } = useQuery<MockMeData>({
    queryKey: ["me", demoMode ? "demo" : "live"],
    queryFn: () => (demoMode ? getMockMe() : (fetchMe() as Promise<MockMeData>)),
  });

  const followMut = useMutation({
    mutationFn: (target_id: string) =>
      demoMode ? toggleMockFollow(target_id) : followFn({ data: { target_id } }),
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
  const posts = data.posts as ProfilePost[];
  const engagementByPost = data.engagementByPost as Record<string, Engagement>;
  const counts = getTypeCounts(posts);
  const visiblePosts = filter === "all" ? posts : posts.filter((post) => post.post_type === filter);
  const favoriteKind = getFavoriteKind(counts);
  const spotlight = getSpotlight(posts, engagementByPost);
  const profileCompletion = getProfileCompletion({
    displayName: data.profile.display_name,
    bio: data.profile.bio,
    avatar: data.profile.avatar_url,
    posts: posts.length,
  });

  async function handleShare() {
    const url = `${window.location.origin}/u/${username}`;
    try {
      if (navigator.share) await navigator.share({ title: `@${username} on Kinetic`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("link copied");
      }
    } catch {
      toast.error("could not share profile");
    }
  }

  return (
    <div className="min-h-[100dvh] pb-8">
      <div className="grad-aurora relative h-48 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.22),transparent_28%),linear-gradient(to_bottom,transparent,rgba(0,0,0,0.5),var(--background))]" />
        <div className="absolute left-4 top-[max(env(safe-area-inset-top),12px)] rounded-full bg-black/35 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/80 backdrop-blur">
          @{data.profile.username}
        </div>
        <div className="absolute right-4 top-[max(env(safe-area-inset-top),12px)] flex gap-2">
          <button
            onClick={handleShare}
            className="grid size-9 place-items-center rounded-full bg-black/40 backdrop-blur transition hover:bg-black/55"
            aria-label="Share"
          >
            <Share2 className="size-4 text-white" />
          </button>
          {isMe && (
            <button
              onClick={() => navigate({ to: "/settings" })}
              className="grid size-9 place-items-center rounded-full bg-black/40 backdrop-blur transition hover:bg-black/55"
              aria-label="Settings"
            >
              <Settings className="size-4 text-white" />
            </button>
          )}
        </div>
      </div>

      <div className="-mt-16 px-5">
        <div className="flex items-end justify-between gap-3">
          <div className="grad-aurora inline-block shrink-0 rounded-full p-[3px]">
            <img
              src={data.profile.avatar_url ?? ""}
              alt=""
              className="size-28 rounded-full border-4 border-background object-cover"
            />
          </div>
          <div className="mb-2 flex min-w-0 flex-1 justify-end">
            {isMe ? (
              <Link
                to="/edit-profile"
                className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold ring-1 ring-white/10 transition hover:bg-white/15"
              >
                edit profile
              </Link>
            ) : (
              <button
                onClick={() => followMut.mutate(data.profile.id)}
                disabled={followMut.isPending}
                className={`flex items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-bold transition ${
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

        <h1 className="mt-3 text-balance font-display text-3xl font-black leading-tight">
          {data.profile.display_name}
        </h1>
        <p className="font-mono text-xs text-muted-foreground">@{data.profile.username}</p>
        {data.profile.bio ? (
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-foreground/90">
            {data.profile.bio}
          </p>
        ) : (
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            {isMe ? "add a bio to give this profile more signal" : "no bio yet"}
          </p>
        )}

        <div className="mt-5 grid grid-cols-3 gap-2">
          <StatTile n={posts.length} label="posts" />
          <StatTile n={data.followers} label="followers" />
          <StatTile n={data.following} label="following" />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <InfoTile icon={<Sparkles />} label="sparks" value={formatCount(data.totalLikes)} />
          <InfoTile
            icon={<MessageCircle />}
            label="replies"
            value={formatCount(data.totalComments)}
          />
          <InfoTile
            icon={<CalendarDays />}
            label="since"
            value={formatMonth(data.profile.created_at)}
          />
          <InfoTile icon={<Wand2 />} label="format" value={readableKind(favoriteKind)} />
        </div>

        {isMe && profileCompletion < 100 && (
          <Link
            to="/edit-profile"
            className="mt-3 block rounded-2xl bg-white/5 p-3 ring-1 ring-white/10 transition hover:ring-primary/60"
          >
            <div className="flex items-center justify-between gap-3">
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
          </Link>
        )}
      </div>

      {spotlight && (
        <section className="mt-6 px-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              spotlight
            </h2>
            <span className="font-mono text-[10px] text-muted-foreground">
              {timeAgo(spotlight.created_at)}
            </span>
          </div>
          <SpotlightPost post={spotlight} engagement={engagementByPost[spotlight.id]} />
        </section>
      )}

      <section className="mt-6 px-1">
        <div className="mb-3 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition ${
                filter === item.id
                  ? "bg-white text-black"
                  : "bg-white/5 text-muted-foreground ring-1 ring-white/10 hover:text-foreground"
              }`}
            >
              {item.icon}
              {item.label}
              <span className="font-mono text-[10px] opacity-70">
                {item.id === "all" ? posts.length : counts[item.id]}
              </span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-1">
          {visiblePosts.map((post) => (
            <PostTile key={post.id} post={post} engagement={engagementByPost[post.id]} />
          ))}
        </div>
        {visiblePosts.length === 0 && (
          <div className="mx-4 rounded-2xl bg-white/5 px-5 py-12 text-center ring-1 ring-white/10">
            <Radio className="mx-auto size-7 text-muted-foreground" />
            <p className="mt-3 font-mono text-xs text-muted-foreground">nothing in this lane yet</p>
          </div>
        )}
      </section>
    </div>
  );
}

function StatTile({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-2xl bg-white/5 px-3 py-3 ring-1 ring-white/10">
      <div className="font-display text-2xl font-black leading-none">{formatCount(n)}</div>
      <div className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function InfoTile({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-3 ring-1 ring-white/10">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/5 text-muted-foreground [&_svg]:size-4">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="truncate font-display text-sm font-bold">{value}</div>
        <div className="truncate font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </div>
      </div>
    </div>
  );
}

function SpotlightPost({ post, engagement }: { post: ProfilePost; engagement?: Engagement }) {
  const spec = parseCanvas(post.canvas_html);
  return (
    <div className="grid grid-cols-[104px_1fr] gap-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
      <PostPreview post={post} className="h-32 rounded-xl" />
      <div className="min-w-0 py-1">
        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <PostKindIcon kind={post.post_type} />
          {readableKind(post.post_type)}
        </div>
        <p className="mt-2 line-clamp-3 text-sm font-bold leading-snug">{spec.text}</p>
        <div className="mt-4 flex gap-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Heart className="size-3" /> {engagement?.likes ?? 0}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="size-3" /> {engagement?.comments ?? 0}
          </span>
        </div>
      </div>
    </div>
  );
}

function PostTile({ post, engagement }: { post: ProfilePost; engagement?: Engagement }) {
  const spec = parseCanvas(post.canvas_html);
  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-md group">
      <PostPreview post={post} className="absolute inset-0" />
      <div
        className="absolute inset-0 flex items-center justify-center p-2 text-center"
        style={{ fontFamily: spec.font, color: spec.color, fontWeight: spec.weight }}
      >
        <span className="line-clamp-3 text-[11px] font-bold drop-shadow">{spec.text}</span>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6 font-mono text-[9px] text-white/85">
        <span className="inline-flex items-center gap-1">
          <PostKindIcon kind={post.post_type} />
          {readableKind(post.post_type)}
        </span>
        <span>{(engagement?.likes ?? 0) + (engagement?.comments ?? 0)}</span>
      </div>
    </div>
  );
}

function PostPreview({ post, className }: { post: ProfilePost; className?: string }) {
  const media = post.media_urls ?? [];
  const spec = parseCanvas(post.canvas_html);
  return (
    <div
      className={`relative overflow-hidden ${className ?? ""}`}
      style={{ background: post.bg_gradient ?? "#111" }}
    >
      {post.post_type === "image" && media[0] && (
        <img src={media[0]} alt="" className="absolute inset-0 size-full object-cover opacity-90" />
      )}
      {post.post_type === "video" && media[0] && (
        <video
          src={media[0]}
          muted
          playsInline
          className="absolute inset-0 size-full object-cover opacity-80"
        />
      )}
      {post.post_type === "slideshow" && media[0] && (
        <img src={media[0]} alt="" className="absolute inset-0 size-full object-cover opacity-90" />
      )}
      {post.post_type === "link" && <ArticleMiniClip title={spec.link?.title ?? spec.text} />}
      {post.post_type !== "text" && <div className="absolute inset-0 bg-black/25" />}
    </div>
  );
}

function PostKindIcon({ kind }: { kind: string }) {
  if (kind === "image") return <ImageIcon className="size-3" />;
  if (kind === "video") return <Video className="size-3" />;
  if (kind === "slideshow") return <Clapperboard className="size-3" />;
  if (kind === "link") return <Newspaper className="size-3" />;
  return <Type className="size-3" />;
}

function getTypeCounts(posts: ProfilePost[]) {
  const counts: Record<PostKind, number> = { text: 0, image: 0, video: 0, slideshow: 0, link: 0 };
  for (const post of posts) {
    if (POST_KINDS.includes(post.post_type as PostKind)) counts[post.post_type as PostKind] += 1;
  }
  return counts;
}

function getFavoriteKind(counts: Record<PostKind, number>) {
  const [favorite] = [...POST_KINDS].sort((a, b) => counts[b] - counts[a]);
  return counts[favorite] > 0 ? favorite : "text";
}

function ArticleMiniClip({ title }: { title: string }) {
  return (
    <div className="absolute inset-x-2 bottom-2 z-10 rounded-sm bg-[#f5f0df] p-2 text-[#17140f] shadow-lg">
      <div className="mb-1 flex items-center justify-between border-b border-black/25 pb-0.5 font-serif text-[7px] font-black uppercase tracking-widest">
        <span>Article</span>
        <Newspaper className="size-2.5" />
      </div>
      <p className="line-clamp-2 font-serif text-[10px] font-black leading-none">{title}</p>
    </div>
  );
}

function getSpotlight(posts: ProfilePost[], engagementByPost: Record<string, Engagement>) {
  if (posts.length === 0) return null;
  return posts.reduce((best, post) => {
    const bestScore = getEngagementScore(best, engagementByPost);
    const score = getEngagementScore(post, engagementByPost);
    if (score > bestScore) return post;
    if (score === bestScore && post.created_at > best.created_at) return post;
    return best;
  }, posts[0]);
}

function getEngagementScore(post: ProfilePost, engagementByPost: Record<string, Engagement>) {
  const engagement = engagementByPost[post.id];
  return (engagement?.likes ?? 0) + (engagement?.comments ?? 0);
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

function readableKind(kind: string) {
  if (kind === "slideshow") return "slides";
  return kind;
}

function formatCount(n: number) {
  return new Intl.NumberFormat("en", { notation: n > 999 ? "compact" : "standard" }).format(n);
}

function formatMonth(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "new";
  return new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(date);
}

function timeAgo(iso: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
