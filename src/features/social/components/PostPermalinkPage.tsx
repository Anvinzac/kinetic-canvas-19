/**
 * Single-post permalink page for `/p/$postId`.
 *
 * Exports: PostPermalinkPage
 * Depends on: features/social API, PostCard, session data mode, mock-data, supabase
 */

import { Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {type ReactElement, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { PostCard } from "@/components/PostCard";
import { resolveDataMode } from "@/features/session";
import {
  addMockComment,
  getMockPost,
  MOCK_ME_ID,
  toggleMockLike,
} from "@/features/demo";
import { supabase } from "@/integrations/supabase/client";
import type { SocialPostData } from "@/shared/types";
import { socialKeys } from "../api/keys";
import { postQueryOptions } from "../api/queries";
import { addComment, getPost, toggleLike } from "../api/social.functions";

/**
 * @responsibility Render one post full-bleed with like/comment, or an unavailable state.
 * @returns Permalink PostCard, loading pulse, or back-to-feed empty state
 */
export function PostPermalinkPage(): ReactElement {
  const { postId } = useParams({ from: "/_authenticated/p/$postId" });
  const qc = useQueryClient();
  const dataMode = resolveDataMode();
  const demoMode = dataMode === "demo";
  const fetchPost = useServerFn(getPost);
  const likeFn = useServerFn(toggleLike);
  const commentFn = useServerFn(addComment);
  const postKey = socialKeys.post(dataMode, postId);

  const { data, isLoading, error } = useQuery(
    postQueryOptions(dataMode, postId, () =>
      fetchPost({ data: { post_id: postId } }) as Promise<SocialPostData>,
    ),
  );

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
      qc.invalidateQueries({ queryKey: postKey });
      qc.invalidateQueries({ queryKey: socialKeys.feedRoot });
      if (demoMode) qc.setQueryData(postKey, getMockPost(postId));
    },
  });

  const commentMut = useMutation({
    mutationFn: ({ post_id, chip_id }: { post_id: string; chip_id: string }) =>
      demoMode ? addMockComment(post_id, chip_id): commentFn({ data: { post_id, chip_id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: postKey });
      qc.invalidateQueries({ queryKey: socialKeys.feedRoot });
      qc.invalidateQueries({ queryKey: socialKeys.notificationsRoot });
      if (demoMode) qc.setQueryData(postKey, getMockPost(postId));
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <div className="grad-aurora size-14 animate-pulse rounded-full" />
      </div>
    );
  }

  if (!data || error) {
    return (
      <div className="grid h-[100dvh] place-items-center px-6 text-center">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-muted-foreground">
            status unavailable
          </p>
          <Link
            to="/feed"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-bold text-background"
          >
            <ArrowLeft className="size-4" />
            feed
          </Link>
        </div>
      </div>
    );
  }

  const profilesById = new Map(data.profiles.map((profile) => [profile.id, profile]));
  const liked = myProfileId
    ? data.likes.some((likeItem) => likeItem.user_id === myProfileId): false;

  return (
    <main className="h-[100dvh] overflow-hidden">
      <PostCard
        post={data.post}
        author={profilesById.get(data.post.author_id)}
        profilesById={profilesById}
        currentUserId={myProfileId}
        likes={data.likes.length}
        comments={data.comments}
        liked={liked}
        onLike={() => likeMut.mutate(data.post.id)}
        onComment={(chip) => commentMut.mutate({ post_id: data.post.id, chip_id: chip })}
      />
    </main>
  );
}
