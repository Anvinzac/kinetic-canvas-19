import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveCanvasBackground } from "@/lib/canvas";
import { z } from "zod";

// ===== Authenticated feed reads =====

const FEED_LIMIT = 60;
const FEED_POOL_LIMIT = 180;
const COLD_START_FOLLOWING_THRESHOLD = 3;
const BOT_AUTHOR_RECENCY_WINDOW_HOURS = 30;
const BOT_AUTHOR_RECENCY_BOOST = 6_000;

type FeedPost = {
  id: string;
  author_id: string;
  post_type: string;
  canvas_html: string;
  media_urls: string[] | null;
  bg_gradient: string | null;
  created_at: string;
};
type FeedLike = { post_id: string; user_id: string };
type FeedComment = {
  id: string;
  post_id: string;
  user_id: string;
  chip_id: string;
  created_at: string;
};

export const getFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: viewer } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle();

    const { data: following } = viewer
      ? await supabaseAdmin.from("follows").select("following_id").eq("follower_id", viewer.id)
      : { data: [] as { following_id: string }[] };
    const followingIds = (following ?? []).map((follow) => follow.following_id);
    const { data: activeBots } = await supabaseAdmin
      .from("bot_agents")
      .select("profile_id")
      .eq("active", true);
    const botAuthorIds = (activeBots ?? []).map((bot) => bot.profile_id).filter(Boolean);

    const { data: feedPool, error } = await supabaseAdmin
      .from("posts")
      .select("id, author_id, post_type, canvas_html, media_urls, bg_gradient, created_at")
      .order("created_at", { ascending: false })
      .limit(FEED_POOL_LIMIT);
    if (error) throw new Error(error.message);

    const poolPosts = (feedPool ?? []) as FeedPost[];
    const poolPostIds = poolPosts.map((post) => post.id);
    if (poolPostIds.length === 0) {
      return { posts: [], profiles: [], likes: [], comments: [] };
    }

    const [{ data: poolLikes }, { data: poolComments }] = await Promise.all([
      supabaseAdmin.from("likes").select("post_id, user_id").in("post_id", poolPostIds),
      supabaseAdmin
        .from("comments")
        .select("id, post_id, user_id, chip_id, created_at")
        .in("post_id", poolPostIds),
    ]);

    const likes = (poolLikes ?? []) as FeedLike[];
    const comments = (poolComments ?? []) as FeedComment[];
    const rankedPosts = rankFeedPosts({
      posts: poolPosts,
      likes,
      comments,
      followingIds,
      botAuthorIds,
      viewerId: viewer?.id ?? null,
    }).slice(0, FEED_LIMIT);

    const selectedPostIds = new Set(rankedPosts.map((post) => post.id));
    const selectedComments = comments.filter((comment) => selectedPostIds.has(comment.post_id));
    const profileIds = [
      ...new Set([
        ...rankedPosts.map((post) => post.author_id),
        ...selectedComments.map((comment) => comment.user_id),
      ]),
    ];
    const { data: profiles } = profileIds.length
      ? await supabaseAdmin
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", profileIds)
      : { data: [] };

    return {
      posts: rankedPosts,
      profiles: profiles ?? [],
      likes: likes.filter((like) => selectedPostIds.has(like.post_id)),
      comments: selectedComments,
    };
  });

export const getPost = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { post_id: string }) => z.object({ post_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: post, error } = await supabaseAdmin
      .from("posts")
      .select("id, author_id, post_type, canvas_html, media_urls, bg_gradient, created_at")
      .eq("id", data.post_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!post) throw new Error("Post not found");

    const [{ data: likes }, { data: comments }] = await Promise.all([
      supabaseAdmin.from("likes").select("post_id, user_id").eq("post_id", data.post_id),
      supabaseAdmin
        .from("comments")
        .select("id, post_id, user_id, chip_id, created_at")
        .eq("post_id", data.post_id)
        .order("created_at", { ascending: true }),
    ]);

    const profileIds = [
      ...new Set([post.author_id, ...(comments ?? []).map((comment) => comment.user_id)]),
    ];
    const { data: profiles } = profileIds.length
      ? await supabaseAdmin
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", profileIds)
      : { data: [] };

    return {
      post,
      profiles: profiles ?? [],
      likes: likes ?? [],
      comments: comments ?? [],
    };
  });

function rankFeedPosts({
  posts,
  likes,
  comments,
  followingIds,
  botAuthorIds,
  viewerId,
}: {
  posts: FeedPost[];
  likes: FeedLike[];
  comments: FeedComment[];
  followingIds: string[];
  botAuthorIds: string[];
  viewerId: string | null;
}) {
  const following = new Set(followingIds);
  const botAuthors = new Set(botAuthorIds);
  const engagement = buildFeedEngagement(likes, comments);
  const isColdStart = followingIds.length < COLD_START_FOLLOWING_THRESHOLD;

  return [...posts].sort((a, b) => {
    const scoreA = getFeedRankScore(
      a,
      engagement.get(a.id),
      following,
      botAuthors,
      viewerId,
      isColdStart,
    );
    const scoreB = getFeedRankScore(
      b,
      engagement.get(b.id),
      following,
      botAuthors,
      viewerId,
      isColdStart,
    );
    if (scoreA !== scoreB) return scoreB - scoreA;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

function buildFeedEngagement(likes: FeedLike[], comments: FeedComment[]) {
  const byPost = new Map<string, { likes: number; comments: number }>();
  for (const like of likes) {
    const current = byPost.get(like.post_id) ?? { likes: 0, comments: 0 };
    current.likes += 1;
    byPost.set(like.post_id, current);
  }
  for (const comment of comments) {
    const current = byPost.get(comment.post_id) ?? { likes: 0, comments: 0 };
    current.comments += 1;
    byPost.set(comment.post_id, current);
  }
  return byPost;
}

function getFeedRankScore(
  post: FeedPost,
  engagement: { likes: number; comments: number } | undefined,
  following: Set<string>,
  botAuthors: Set<string>,
  viewerId: string | null,
  isColdStart: boolean,
) {
  const likes = engagement?.likes ?? 0;
  const comments = engagement?.comments ?? 0;
  const popularity = likes * 2 + comments * 3;
  const ageHours = Math.max(1, (Date.now() - new Date(post.created_at).getTime()) / 3_600_000);
  const recency = 24 / Math.sqrt(ageHours);

  if (isColdStart) {
    return popularity * 100 + recency;
  }

  const relationshipBoost =
    following.has(post.author_id) || (viewerId != null && post.author_id === viewerId) ? 10_000 : 0;
  const botRecencyBoost =
    botAuthors.has(post.author_id) && ageHours <= BOT_AUTHOR_RECENCY_WINDOW_HOURS
      ? BOT_AUTHOR_RECENCY_BOOST
      : 0;
  return relationshipBoost + botRecencyBoost + popularity * 25 + recency;
}

export const getProfile = createServerFn({ method: "GET" })
  .inputValidator((d: { username: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio, created_at")
      .eq("username", data.username)
      .maybeSingle();
    if (!profile) throw new Error("Not found");
    const { data: posts } = await supabaseAdmin
      .from("posts")
      .select("id, post_type, canvas_html, media_urls, bg_gradient, created_at")
      .eq("author_id", profile.id)
      .order("created_at", { ascending: false });
    const postIds = (posts ?? []).map((p) => p.id);
    const [{ count: followers }, { count: following }, { data: likes }, { data: comments }] =
      await Promise.all([
        supabaseAdmin
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("following_id", profile.id),
        supabaseAdmin
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("follower_id", profile.id),
        postIds.length
          ? supabaseAdmin.from("likes").select("post_id").in("post_id", postIds)
          : Promise.resolve({ data: [] as { post_id: string }[] }),
        postIds.length
          ? supabaseAdmin.from("comments").select("post_id").in("post_id", postIds)
          : Promise.resolve({ data: [] as { post_id: string }[] }),
      ]);

    const engagementByPost: Record<string, { likes: number; comments: number }> = {};
    for (const id of postIds) engagementByPost[id] = { likes: 0, comments: 0 };
    for (const like of likes ?? []) engagementByPost[like.post_id]!.likes += 1;
    for (const comment of comments ?? []) engagementByPost[comment.post_id]!.comments += 1;

    return {
      profile,
      posts: posts ?? [],
      followers: followers ?? 0,
      following: following ?? 0,
      totalLikes: (likes ?? []).length,
      totalComments: (comments ?? []).length,
      engagementByPost,
    };
  });

// ===== Authenticated actions =====

export const ensureProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const { data: existing } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .eq("auth_user_id", userId)
      .maybeSingle();
    if (existing) return existing;

    const email = (claims.email as string) || `user-${userId.slice(0, 6)}@demo`;
    const baseHandle =
      (claims.user_metadata as Record<string, unknown> | undefined)?.preferred_username ||
      (claims.user_metadata as Record<string, unknown> | undefined)?.name ||
      email.split("@")[0];
    const username = `${String(baseHandle)
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 14)}_${userId.slice(0, 4)}`;
    const display =
      ((claims.user_metadata as Record<string, unknown> | undefined)?.full_name as string) ||
      ((claims.user_metadata as Record<string, unknown> | undefined)?.name as string) ||
      "New Creator";
    const avatar =
      ((claims.user_metadata as Record<string, unknown> | undefined)?.avatar_url as string) ||
      `https://i.pravatar.cc/200?u=${userId}`;

    const { data: created, error } = await supabase
      .from("profiles")
      .insert({
        auth_user_id: userId,
        username,
        display_name: display,
        avatar_url: avatar,
        bio: "",
      })
      .select("id, username, display_name, avatar_url")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

const POST_TYPES = ["text", "image", "video", "slideshow", "link"] as const;

export const createPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { post_type: string; canvas_html: string; media_urls?: string[]; bg_gradient: string }) =>
      z
        .object({
          post_type: z.enum(POST_TYPES),
          canvas_html: z
            .string()
            .min(1)
            .max(1024 * 1024), // 1MB cap
          media_urls: z.array(z.string().url()).max(10).optional().default([]),
          bg_gradient: z.string().max(500),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle();
    if (!profile) throw new Error("Profile missing");
    const { data: post, error } = await supabase
      .from("posts")
      .insert({
        author_id: profile.id,
        post_type: data.post_type,
        canvas_html: data.canvas_html,
        media_urls: data.media_urls ?? [],
        bg_gradient: resolveCanvasBackground(data.bg_gradient, profile.id),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return post;
  });

export const toggleLike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { post_id: string }) => z.object({ post_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle();
    if (!profile) throw new Error("Profile missing");
    const { data: existing } = await supabase
      .from("likes")
      .select("*")
      .eq("user_id", profile.id)
      .eq("post_id", data.post_id)
      .maybeSingle();
    if (existing) {
      await supabase.from("likes").delete().eq("user_id", profile.id).eq("post_id", data.post_id);
      return { liked: false };
    }
    await supabase.from("likes").insert({ user_id: profile.id, post_id: data.post_id });
    return { liked: true };
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { post_id: string; chip_id: string }) =>
    z
      .object({
        post_id: z.string().uuid(),
        chip_id: z
          .string()
          .trim()
          .min(1)
          .max(240)
          .refine((value) => value.trim().split(/\s+/).length <= 36, {
            message: "Comment must be 36 words or fewer",
          }),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle();
    if (!profile) throw new Error("Profile missing");
    const { error } = await supabase
      .from("comments")
      .insert({ post_id: data.post_id, user_id: profile.id, chip_id: data.chip_id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===== Demo one-click signup (creates real auth user via admin, returns tokens) =====
// Note: this is intentionally public so first-time visitors can try the app.

const ADJ = ["nova", "kai", "mira", "zeph", "lila", "echo", "vex", "rune", "iris", "axl"];
const NOUN = ["loop", "aux", "404", "om", "rae", "wave", "kid", "drift", "muse", "void"];

export const createDemoAccount = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const tag = Math.random().toString(36).slice(2, 8);
  const handle = `${ADJ[Math.floor(Math.random() * ADJ.length)]}_${NOUN[Math.floor(Math.random() * NOUN.length)]}_${tag.slice(0, 3)}`;
  const email = `demo-${tag}@kinetic.local`;
  const password = `Demo!${tag}${Math.random().toString(36).slice(2, 8)}`;

  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: handle,
      name: handle,
      avatar_url: `https://i.pravatar.cc/200?u=${handle}`,
    },
  });
  if (createErr || !created.user)
    throw new Error(createErr?.message ?? "Could not create demo account");

  // Insert profile directly (we have admin)
  await supabaseAdmin.from("profiles").insert({
    auth_user_id: created.user.id,
    username: handle,
    display_name: handle.replace(/_/g, " "),
    avatar_url: `https://i.pravatar.cc/200?u=${handle}`,
    bio: "demo account · kinetic typography",
  });

  // Auto-follow the seeded creators and active content bots so demo feeds show
  // scheduled network content immediately.
  const { data: seeded } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .in("username", ["nova_rae", "kai_loop", "mira_aux", "zeph_404", "lila_om", "do_chu_bot"]);
  const { data: me } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("auth_user_id", created.user.id)
    .single();
  if (me && seeded) {
    await supabaseAdmin
      .from("follows")
      .insert(seeded.map((s) => ({ follower_id: me.id, following_id: s.id })));
  }

  // Sign in to retrieve session tokens
  const { data: signin, error: signErr } = await supabaseAdmin.auth.signInWithPassword({
    email,
    password,
  });
  if (signErr || !signin.session)
    throw new Error(signErr?.message ?? "Could not start demo session");

  return {
    access_token: signin.session.access_token,
    refresh_token: signin.session.refresh_token,
    handle,
  };
});
