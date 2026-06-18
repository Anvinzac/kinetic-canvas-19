import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getFeed, toggleLike, addComment } from "@/lib/social.functions";
import { PostCard } from "@/components/PostCard";
import { supabase } from "@/integrations/supabase/client";
import { isDemoSession } from "@/lib/demo-session";
import {
  addMockComment,
  getMockFeed,
  MOCK_ME_ID,
  toggleMockLike,
  type MockFeedData,
} from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/feed")({
  component: FeedPage,
});

function FeedPage() {
  const qc = useQueryClient();
  const fetchFeed = useServerFn(getFeed);
  const likeFn = useServerFn(toggleLike);
  const commentFn = useServerFn(addComment);
  const demoMode = isDemoSession();
  const feedKey = ["feed", demoMode ? "demo" : "live"];

  const { data, isLoading } = useQuery<MockFeedData>({
    queryKey: feedKey,
    queryFn: () => (demoMode ? getMockFeed() : (fetchFeed() as Promise<MockFeedData>)),
    staleTime: 30_000,
  });

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
      demoMode ? toggleMockLike(post_id) : likeFn({ data: { post_id } }),
    onSuccess: () => {
      if (demoMode) {
        qc.setQueryData(feedKey, getMockFeed());
        qc.invalidateQueries({ queryKey: ["profile"] });
        return;
      }
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
  });
  const commentMut = useMutation({
    mutationFn: ({ post_id, chip_id }: { post_id: string; chip_id: string }) =>
      demoMode ? addMockComment(post_id, chip_id) : commentFn({ data: { post_id, chip_id } }),
    onSuccess: () => {
      if (demoMode) {
        qc.setQueryData(feedKey, getMockFeed());
        qc.invalidateQueries({ queryKey: ["notifications"] });
        qc.invalidateQueries({ queryKey: ["profile"] });
        return;
      }
      qc.invalidateQueries({ queryKey: ["feed"] });
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
      <main className="scrollbar-hide h-[100dvh] snap-y snap-mandatory overflow-y-scroll">
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
                ? (likesByPost.get(p.id) ?? []).some((l) => l.user_id === myProfileId)
                : false
            }
            onLike={() => likeMut.mutate(p.id)}
            onComment={(chip) => commentMut.mutate({ post_id: p.id, chip_id: chip })}
          />
        ))}
      </main>
    </div>
  );
}
