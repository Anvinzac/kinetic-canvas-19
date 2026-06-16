import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getFeed, toggleLike, addComment } from "@/lib/social.functions";
import { PostCard } from "@/components/PostCard";
import { supabase } from "@/integrations/supabase/client";
import { LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/feed")({
  component: FeedPage,
});

function FeedPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchFeed = useServerFn(getFeed);
  const likeFn = useServerFn(toggleLike);
  const commentFn = useServerFn(addComment);

  const { data, isLoading } = useQuery({
    queryKey: ["feed"],
    queryFn: () => fetchFeed(),
    staleTime: 30_000,
  });

  const [myProfileId, setMyProfileId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: p } = await supabase.from("profiles").select("id").eq("auth_user_id", u.user.id).maybeSingle();
      if (p) setMyProfileId(p.id);
    })();
  }, []);

  const likeMut = useMutation({
    mutationFn: (post_id: string) => likeFn({ data: { post_id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feed"] }),
  });
  const commentMut = useMutation({
    mutationFn: ({ post_id, chip_id }: { post_id: string; chip_id: string }) =>
      commentFn({ data: { post_id, chip_id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feed"] }),
  });

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

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
      <header className="pointer-events-none fixed inset-x-0 top-0 z-40 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)]">
        <span className="font-impact text-xl text-white drop-shadow">KINETIC</span>
        <button
          onClick={handleSignOut}
          className="pointer-events-auto flex size-9 items-center justify-center rounded-full bg-black/40 backdrop-blur"
          aria-label="Sign out"
        >
          <LogOut className="size-4 text-white" />
        </button>
      </header>

      <main className="scrollbar-hide h-[100dvh] snap-y snap-mandatory overflow-y-scroll">
        {data.posts.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            author={profilesById.get(p.author_id)}
            likes={likesByPost.get(p.id)?.length ?? 0}
            comments={commentsByPost.get(p.id) ?? []}
            liked={myProfileId ? (likesByPost.get(p.id) ?? []).some((l) => l.user_id === myProfileId) : false}
            onLike={() => likeMut.mutate(p.id)}
            onComment={(chip) => commentMut.mutate({ post_id: p.id, chip_id: chip })}
          />
        ))}
      </main>
    </div>
  );
}
