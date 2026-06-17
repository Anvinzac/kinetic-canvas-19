import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ===== Public reads =====

export const getFeed = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: posts, error } = await supabaseAdmin
    .from("posts")
    .select("id, author_id, post_type, canvas_html, media_urls, bg_gradient, created_at")
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw new Error(error.message);

  const authorIds = [...new Set((posts ?? []).map((p) => p.author_id))];
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", authorIds);

  const postIds = (posts ?? []).map((p) => p.id);
  const [{ data: likes }, { data: comments }] = await Promise.all([
    supabaseAdmin.from("likes").select("post_id, user_id").in("post_id", postIds),
    supabaseAdmin
      .from("comments")
      .select("id, post_id, user_id, chip_id, created_at")
      .in("post_id", postIds),
  ]);

  return {
    posts: posts ?? [],
    profiles: profiles ?? [],
    likes: likes ?? [],
    comments: comments ?? [],
  };
});

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

const POST_TYPES = ["text", "image", "video", "slideshow"] as const;

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
        bg_gradient: data.bg_gradient,
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
          .max(120)
          .refine((value) => value.trim().split(/\s+/).length <= 10, {
            message: "Comment must be 10 words or fewer",
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

  // Auto-follow the 5 seeded creators
  const { data: seeded } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .in("username", ["nova_rae", "kai_loop", "mira_aux", "zeph_404", "lila_om"]);
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
