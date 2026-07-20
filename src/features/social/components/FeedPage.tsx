/**
 * Authenticated vertical status feed page.
 *
 * Exports: FeedPage
 * Depends on: features/social API, PostCard, session data mode, mock-data, supabase
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {type ReactElement, useEffect, useState } from "react";
import { PostCard } from "@/components/PostCard";
import { supabase } from "@/integrations/supabase/client";
import { resolveDataMode } from "@/features/session";
import { useStatusScrollSnap } from "@/lib/use-status-scroll-snap";
import {
  addMockComment,
  getMockFeed,
  MOCK_ME_ID,
  toggleMockLike,
} from "@/features/demo";
import type { SocialFeedData } from "@/shared/types";
import { socialKeys } from "../api/keys";
import { feedQueryOptions } from "../api/queries";
import { addComment, getFeed, toggleLike } from "../api/social.functions";

/**
 * @responsibility Render the snap-scrolling home feed with like/comment mutations.
 * @returns Full-viewport feed of PostCards, or a loading pulse
 */
export function FeedPage(): ReactElement {
  const qc = useQueryClient();
  const fetchFeed = useServerFn(getFeed);
  const likeFn = useServerFn(toggleLike);
  const commentFn = useServerFn(addComment);
  const dataMode = resolveDataMode();
  const demoMode = dataMode === "demo";
  const feedKey = socialKeys.feed(dataMode);

  const { data, isLoading } = useQuery(
    feedQueryOptions(dataMode, () => fetchFeed() as Promise<SocialFeedData>),
  );
  const scrollRef = useStatusScrollSnap(data?.posts.length ?? 0);

  const [myProfileId, setMyProfileId] = useState<string | null>(null);

  useEffect(() => {
    if (demoMode) {
      setMyProfileId(MOCK_ME_ID);
      return;
    }

    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("id")
        .eq("auth_user_id", u.user.id)
        .maybeSingle();
      if (p) setMyProfileId(p.id);
    })();
  }, [demoMode]);

  const likeMut = useMutation({
    mutationFn: (post_id: string) =>
      demoMode ? toggleMockLike(post_id): likeFn({ data: { post_id } }),
    onSuccess: () => {
      if (demoMode) {
        qc.setQueryData(feedKey, getMockFeed());
        qc.invalidateQueries({ queryKey: socialKeys.profileRoot });
        return;
      }
      qc.invalidateQueries({ queryKey: socialKeys.feedRoot });
    },
  });
  const commentMut = useMutation({
    mutationFn: ({ post_id, chip_id }: { post_id: string; chip_id: string }) =>
      demoMode ? addMockComment(post_id, chip_id): commentFn({ data: { post_id, chip_id } }),
    onSuccess: () => {
      if (demoMode) {
        qc.setQueryData(feedKey, getMockFeed());
        qc.invalidateQueries({ queryKey: socialKeys.notificationsRoot });
        qc.invalidateQueries({ queryKey: socialKeys.profileRoot });
        return;
      }
      qc.invalidateQueries({ queryKey: socialKeys.feedRoot });
    },
  });

  if (isLoading || !data) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <div className="grad-aurora size-14 animate-pulse rounded-full" />
      </div>
    );
  }

  const profilesById = new Map(data.profiles.map((p) => [p.id, p]));
  const likesByPost = new Map<string, { user_id: string }[]>();
  for (const l of data.likes) {
    if (!likesByPost.has(l.post_id)) likesByPost.set(l.post_id, []);
    likesByPost.get(l.post_id)!.push({ user_id: l.user_id });
  }
  const commentsByPost = new Map<string, typeof data.comments>();
  for (const c of data.comments) {
    if (!commentsByPost.has(c.post_id)) commentsByPost.set(c.post_id, []);
    commentsByPost.get(c.post_id)!.push(c);
  }

  return (
    <div className="relative">
      <main
        ref={scrollRef}
        className="scrollbar-hide h-[100dvh] snap-y snap-mandatory overflow-y-scroll overscroll-contain [touch-action:pan-y]"
      >
        {data.posts.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            author={profilesById.get(p.author_id)}
            profilesById={profilesById}
            currentUserId={myProfileId}
            likes={likesByPost.get(p.id)?.length ?? 0}
            comments={commentsByPost.get(p.id) ?? []}
            liked={
              myProfileId
                ? (likesByPost.get(p.id) ?? []).some((l) => l.user_id === myProfileId): false
            }
            onLike={() => likeMut.mutate(p.id)}
            onComment={(chip) => commentMut.mutate({ post_id: p.id, chip_id: chip })}
          />
        ))}
      </main>
    </div>
  );
}
