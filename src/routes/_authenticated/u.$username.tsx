import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useState, type ReactNode } from "react";
import { getProfile } from "@/lib/social.functions";
import { getMe, toggleFollow } from "@/lib/discovery.functions";
import { PostCard, paginateText } from "@/components/PostCard";
import { KineticText } from "@/components/KineticText";
import { parseCanvas, resolveCanvasBackground } from "@/lib/canvas";
import { isDemoSession } from "@/lib/demo-session";
import { useStatusScrollSnap } from "@/lib/use-status-scroll-snap";
import {
  getMockMe,
  getMockProfile,
  toggleMockFollow,
  type MockMeData,
  type MockPost,
  type MockProfileData,
} from "@/lib/mock-data";
import {
  ArrowLeft,
  Clapperboard,
  Clock,
  Flame,
  Grid3X3,
  Image as ImageIcon,
  Newspaper,
  Settings,
  Share2,
  Shuffle,
  Type,
  UserCheck,
  UserPlus,
  Video,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/u/$username")({
  component: ProfilePage,
});

type PostKind = "text" | "image" | "video" | "slideshow" | "link";
type PostFilter = "all" | PostKind;
type PostSort = "recent" | "popular" | "shuffle";
type Engagement = { likes: number; comments: number };

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
  const router = useRouter();
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getProfile);
  const fetchMe = useServerFn(getMe);
  const followFn = useServerFn(toggleFollow);
  const [filter, setFilter] = useState<PostFilter>("all");
  const [sort, setSort] = useState<PostSort>("recent");
  const [shuffleSeed, setShuffleSeed] = useState(0);
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
  const scrollRef = useStatusScrollSnap<HTMLDivElement>(data?.posts.length ?? 0);

  if (isLoading || !data) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <div className="grad-aurora size-12 animate-pulse rounded-full" />
      </div>
    );
  }

  const isMe = me?.profile?.id === data.profile.id;
  const isFollowing = me?.followingIds?.includes(data.profile.id) ?? false;
  const rawPosts = data.posts as MockPost[];
  const posts =
    data.profile.username === "do_chu_bot" ? prioritizeVietnamYesterdayPosts(rawPosts) : rawPosts;
  const engagementByPost = data.engagementByPost as Record<string, Engagement>;
  const counts = getTypeCounts(posts);
  const profilesById = new Map([[data.profile.id, data.profile]]);
  const currentUserId = me?.profile?.id ?? null;

  const visiblePosts = getSortedPosts(
    filter === "all" ? posts : posts.filter((post) => post.post_type === filter),
    sort,
    engagementByPost,
    shuffleSeed,
  );

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

  function handleBack() {
    if (router.history.length > 1) {
      router.history.back();
    } else {
      navigate({ to: "/feed" });
    }
  }

  return (
    <div
      ref={scrollRef}
      className="h-[100dvh] snap-y snap-mandatory overflow-y-scroll overscroll-contain scrollbar-hide [touch-action:pan-y]"
    >
      {/* Page 1: Profile info */}
      <div
        data-status-snap-item="true"
        className="flex h-[100dvh] snap-start snap-always flex-col px-5 pb-4 pt-2"
      >
        {/* Avatar + info with back button inline */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 ring-1 ring-white/10 transition hover:bg-white/15 active:scale-95"
            aria-label="Go back"
          >
            <ArrowLeft className="size-3.5" />
          </button>
          <div className="grad-aurora inline-block shrink-0 rounded-full p-[2px]">
            <img
              src={data.profile.avatar_url ?? ""}
              alt=""
              className="size-20 rounded-full border-[3px] border-background object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-xl font-black leading-tight">
              {data.profile.display_name}
            </h1>
            <p className="font-mono text-[11px] text-muted-foreground">@{data.profile.username}</p>
            <div className="mt-1.5 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <span>
                <strong className="text-foreground">{formatCount(posts.length)}</strong> posts
              </span>
              <span>
                <strong className="text-foreground">{formatCount(data.followers)}</strong> followers
              </span>
              <span>
                <strong className="text-foreground">{formatCount(data.following)}</strong> following
              </span>
            </div>
          </div>
        </div>

        {data.profile.bio && (
          <p className="mt-2 text-sm leading-relaxed text-foreground/85">{data.profile.bio}</p>
        )}

        {/* Action buttons */}
        <div className="mt-2.5 flex items-center gap-2">
          {isMe ? (
            <>
              <Link
                to="/edit-profile"
                className="flex-1 rounded-full bg-white/10 px-4 py-2 text-center text-sm font-bold ring-1 ring-white/10 transition hover:bg-white/15"
              >
                edit profile
              </Link>
              <button
                onClick={() => navigate({ to: "/settings" })}
                className="grid size-9 place-items-center rounded-full bg-white/10 ring-1 ring-white/10 transition hover:bg-white/15"
                aria-label="Settings"
              >
                <Settings className="size-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => followMut.mutate(data.profile.id)}
                disabled={followMut.isPending}
                className={`flex flex-1 items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-bold transition ${
                  isFollowing
                    ? "bg-white/10 ring-1 ring-white/10 hover:bg-white/15"
                    : "grad-aurora text-white shadow-[var(--shadow-glow)]"
                }`}
              >
                {isFollowing ? <UserCheck className="size-4" /> : <UserPlus className="size-4" />}
                {isFollowing ? "following" : "follow"}
              </button>
              <button
                onClick={handleShare}
                className="grid size-9 place-items-center rounded-full bg-white/10 ring-1 ring-white/10 transition hover:bg-white/15"
                aria-label="Share"
              >
                <Share2 className="size-4" />
              </button>
            </>
          )}
        </div>

        {/* Horizontal masonry post preview library — 9:16 ratio, alternating tall + stacked pair */}
        {posts.length > 0 && (
          <div className="mt-3 flex-1 min-h-0 overflow-hidden">
            <div className="flex h-full gap-1.5 overflow-x-auto scrollbar-hide">
              {Array.from({ length: Math.ceil(posts.length / 3) }, (_, groupIdx) => {
                const tallPost = posts[groupIdx * 3];
                const shortPostA = posts[groupIdx * 3 + 1];
                const shortPostB = posts[groupIdx * 3 + 2];

                return (
                  <Fragment key={groupIdx}>
                    {/* Tall card — full height, 9:16 */}
                    {tallPost && (
                      <MasonryCard post={tallPost} className="h-full aspect-[9/16] shrink-0" />
                    )}
                    {/* Two short cards stacked — each half height, 9:16 */}
                    {(shortPostA || shortPostB) && (
                      <div className="flex h-full flex-col gap-1.5 shrink-0">
                        {shortPostA && (
                          <MasonryCard post={shortPostA} className="aspect-[9/16] h-1/2" />
                        )}
                        {shortPostB && (
                          <MasonryCard post={shortPostB} className="aspect-[9/16] h-1/2" />
                        )}
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </div>
          </div>
        )}

        {/* Filter + sort controls */}
        <div className="mt-3 shrink-0">
          <div className="mb-2 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                onClick={() => setFilter(item.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
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

          <div className="flex items-center gap-1.5">
            <SortButton
              active={sort === "recent"}
              onClick={() => setSort("recent")}
              icon={<Clock className="size-3" />}
              label="recent"
            />
            <SortButton
              active={sort === "popular"}
              onClick={() => setSort("popular")}
              icon={<Flame className="size-3" />}
              label="popular"
            />
            <SortButton
              active={sort === "shuffle"}
              onClick={() => {
                setSort("shuffle");
                setShuffleSeed((s) => s + 1);
              }}
              icon={<Shuffle className="size-3" />}
              label="shuffle"
            />
          </div>
        </div>

        {visiblePosts.length > 0 && (
          <div className="flex shrink-0 flex-col items-center gap-1 pb-2 pt-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
              scroll for posts
            </span>
            <span className="h-4 w-px bg-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* Posts: each is a full-screen kinetic PostCard */}
      {visiblePosts.map((post) => (
        <div key={post.id} className="h-[100dvh] snap-start snap-always">
          <PostCard
            post={post}
            author={data.profile}
            profilesById={profilesById}
            currentUserId={currentUserId}
            likes={engagementByPost[post.id]?.likes ?? 0}
            comments={[]}
            liked={false}
            onLike={() => {}}
            onComment={() => {}}
          />
        </div>
      ))}

      {visiblePosts.length === 0 && (
        <div
          data-status-snap-item="true"
          className="flex h-[100dvh] snap-start snap-always items-center justify-center px-5"
        >
          <div className="rounded-2xl bg-white/5 px-5 py-12 text-center ring-1 ring-white/10">
            <p className="font-mono text-xs text-muted-foreground">no posts in this lane yet</p>
          </div>
        </div>
      )}
    </div>
  );
}

function MasonryCard({ post, className }: { post: MockPost; className?: string }) {
  const spec = parseCanvas(post.canvas_html);
  // Show only the first page — a single full sentence laid out exactly as it
  // looks after one run on the canvas — instead of cramming the whole poem into
  // unreadable tiny text.
  const firstPage = paginateText(spec.text)[0] ?? spec.text;
  const previewSpec = { ...spec, text: firstPage };
  const background = resolveCanvasBackground(post.bg_gradient, post.id);
  const media = post.media_urls ?? [];
  const hasImage =
    (post.post_type === "image" || post.post_type === "slideshow") && Boolean(media[0]);

  return (
    <div
      className={`relative overflow-hidden rounded-lg ring-1 ring-white/10 ${className ?? ""}`}
      style={{ background }}
    >
      {hasImage && (
        <img src={media[0]!} alt="" className="absolute inset-0 size-full object-cover" />
      )}
      {post.post_type !== "text" && (
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/55" />
      )}
      <div className="absolute inset-0">
        <KineticText spec={previewSpec} paused scaleToCanvas background={background} />
      </div>
    </div>
  );
}

function SortButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] transition ${
        active
          ? "bg-white/15 text-foreground ring-1 ring-white/20"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function getSortedPosts(
  posts: MockPost[],
  sort: PostSort,
  engagementByPost: Record<string, Engagement>,
  shuffleSeed: number,
): MockPost[] {
  if (sort === "popular") {
    return [...posts].sort((a, b) => {
      const scoreA = (engagementByPost[a.id]?.likes ?? 0) + (engagementByPost[a.id]?.comments ?? 0);
      const scoreB = (engagementByPost[b.id]?.likes ?? 0) + (engagementByPost[b.id]?.comments ?? 0);
      return scoreB - scoreA;
    });
  }
  if (sort === "shuffle") {
    return [...posts].sort((a, b) => {
      const hashA = seededHash(a.id, shuffleSeed);
      const hashB = seededHash(b.id, shuffleSeed);
      return hashA - hashB;
    });
  }
  // recent (default) - already sorted by created_at desc from the data source
  return posts;
}

function prioritizeVietnamYesterdayPosts(posts: MockPost[]) {
  const yesterdayKey = getVietnamDateKey(Date.now() - 24 * 60 * 60 * 1000);
  const yesterdayPosts = posts.filter(
    (post) => getVietnamDateKey(post.created_at) === yesterdayKey,
  );
  if (yesterdayPosts.length < 3) return posts;

  const yesterdayIds = new Set(yesterdayPosts.map((post) => post.id));
  return [
    ...yesterdayPosts.sort((a, b) => b.created_at.localeCompare(a.created_at)),
    ...posts.filter((post) => !yesterdayIds.has(post.id)),
  ];
}

function getVietnamDateKey(value: string | number) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function seededHash(value: string, seed: number): number {
  let h = seed * 2654435761;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function getTypeCounts(posts: MockPost[]) {
  const counts: Record<PostKind, number> = { text: 0, image: 0, video: 0, slideshow: 0, link: 0 };
  for (const post of posts) {
    if (POST_KINDS.includes(post.post_type as PostKind)) counts[post.post_type as PostKind] += 1;
  }
  return counts;
}

function formatCount(n: number) {
  return new Intl.NumberFormat("en", { notation: n > 999 ? "compact" : "standard" }).format(n);
}
