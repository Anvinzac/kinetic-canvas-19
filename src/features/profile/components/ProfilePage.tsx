/**
 * Profile page shell: identity snap, filters, masonry, and post snap stack.
 *
 * Exports: ProfilePage
 * Depends on: discovery/social queries, ProfileHeader/FilterBar/MasonryGrid
 */

import { useNavigate, useParams, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactElement } from "react";
import { toast } from "sonner";
import { PostCard } from "@/components/PostCard";
import {
  discoveryKeys,
  getMe,
  meQueryOptions,
  profileQueryOptions,
  toggleFollow,
} from "@/features/discovery";
import { getProfile } from "@/features/social";
import { resolveDataMode } from "@/features/session";
import { useStatusScrollSnap } from "@/lib/use-status-scroll-snap";
import { toggleMockFollow, type MockPost } from "@/lib/mock-data";
import type { SocialMeData, SocialProfileData } from "@/shared/types";
import {
  getSortedPosts,
  getTypeCounts,
  prioritizeVietnamYesterdayPosts,
  type Engagement,
  type PostFilter,
  type PostSort,
} from "../lib/filters";
import { ProfileFilterBar } from "./ProfileFilterBar";
import { ProfileHeader } from "./ProfileHeader";
import { ProfileMasonryGrid } from "./ProfileMasonryGrid";

/**
 * Compose a user's profile with snap-scrolling post stack.
 * @returns Profile page (loading spinner while fetching)
 */
export function ProfilePage(): ReactElement {
  const { username } = useParams({ from: "/_authenticated/u/$username" });
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getProfile);
  const fetchMe = useServerFn(getMe);
  const followFn = useServerFn(toggleFollow);
  const [filter, setFilter] = useState<PostFilter>("all");
  const [sort, setSort] = useState<PostSort>("recent");
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const dataMode = resolveDataMode();
  const demoMode = dataMode === "demo";

  const { data, isLoading } = useQuery(
    profileQueryOptions(username, dataMode, () =>
      fetchProfile({ data: { username } }) as Promise<SocialProfileData>,
    ),
  );
  const { data: me } = useQuery(meQueryOptions(dataMode, () => fetchMe() as Promise<SocialMeData>));

  const followMut = useMutation({
    mutationFn: (target_id: string) =>
      demoMode ? toggleMockFollow(target_id) : followFn({ data: { target_id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: discoveryKeys.meRoot });
      qc.invalidateQueries({ queryKey: [...discoveryKeys.profileRoot, username] });
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

  async function handleShare(): Promise<void> {
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

  function handleBack(): void {
    if (router.history.length > 1) router.history.back();
    else navigate({ to: "/feed" });
  }

  return (
    <div
      ref={scrollRef}
      className="h-[100dvh] snap-y snap-mandatory overflow-y-scroll overscroll-contain scrollbar-hide [touch-action:pan-y]"
    >
      <div
        data-status-snap-item="true"
        className="flex h-[100dvh] min-h-0 snap-start snap-always flex-col overflow-y-auto px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(env(safe-area-inset-top),12px)]"
      >
        <ProfileHeader
          displayName={data.profile.display_name}
          username={data.profile.username}
          avatarUrl={data.profile.avatar_url}
          bio={data.profile.bio ?? null}
          postCount={posts.length}
          followers={data.followers}
          following={data.following}
          isMe={isMe}
          isFollowing={isFollowing}
          followPending={followMut.isPending}
          onBack={handleBack}
          onSettings={() => navigate({ to: "/settings" })}
          onShare={handleShare}
          onFollow={() => followMut.mutate(data.profile.id)}
        />

        <ProfileMasonryGrid posts={posts} />

        <ProfileFilterBar
          filter={filter}
          sort={sort}
          counts={counts}
          totalPosts={posts.length}
          onFilterChange={setFilter}
          onSortChange={setSort}
          onShuffle={() => {
            setSort("shuffle");
            setShuffleSeed((s) => s + 1);
          }}
        />

        {visiblePosts.length > 0 && (
          <div className="flex shrink-0 flex-col items-center gap-1 pb-2 pt-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
              scroll for posts
            </span>
            <span className="h-4 w-px bg-muted-foreground/30" />
          </div>
        )}
      </div>

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
