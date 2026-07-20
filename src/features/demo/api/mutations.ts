/**
 * Demo mutation APIs — likes, comments, follows, profile patch, local posts.
 *
 * Exports: toggleMockLike, addMockComment, toggleMockFollow, updateMockProfile, addMockPost
 * Depends on: demo seed MOCK_ME_ID, store overlays
 */

import type { PostType } from "@/shared/types";
import { MOCK_ME_ID, type MockComment, type MockPost, type MockProfile } from "../seed";
import {
  FOLLOWING_KEY,
  LIKED_POSTS_KEY,
  LOCAL_COMMENTS_KEY,
  LOCAL_POSTS_KEY,
  PROFILE_PATCH_KEY,
  makeUuid,
  readFollowingIds,
  readJsonArray,
  readLikedPostIds,
  writeJson,
  writeJsonArray,
} from "../store";

/**
 * Toggle whether the demo viewer likes a post (persisted overlay).
 * @param postId - postId argument
 * @returns Function result
 */
export async function toggleMockLike(postId: string): Promise<{ liked: boolean }> {
  const liked = new Set(readLikedPostIds());
  if (liked.has(postId)) {
    liked.delete(postId);
    writeJsonArray(LIKED_POSTS_KEY, [...liked]);
    return { liked: false };
  }

  liked.add(postId);
  writeJsonArray(LIKED_POSTS_KEY, [...liked]);
  void import("@/features/admin/lib/emit").then(({ emitTelemetryEvent }) =>
    emitTelemetryEvent({
      mode: "demo",
      event_type: "link.interacted",
      actor_user_id: MOCK_ME_ID,
      entity_type: "post",
      entity_id: postId,
      metadata: { interaction: "like" },
    }),
  );
  return { liked: true };
}

/**
 * Append a chip comment from the demo viewer onto a post (persisted overlay).
 * @param postId - postId argument
 * @param chipId - chipId argument
 * @returns Function result
 */
export async function addMockComment(postId: string, chipId: string): Promise<{ ok: true }> {
  const comments = readJsonArray<MockComment>(LOCAL_COMMENTS_KEY);
  const next: MockComment = {
    id: makeUuid(),
    post_id: postId,
    user_id: MOCK_ME_ID,
    chip_id: chipId,
    created_at: new Date().toISOString(),
  };
  writeJsonArray(LOCAL_COMMENTS_KEY, [...comments, next]);
  void import("@/features/admin/lib/emit").then(({ emitTelemetryEvent }) => {
    void emitTelemetryEvent({
      mode: "demo",
      event_type: "content.created",
      actor_user_id: MOCK_ME_ID,
      entity_type: "comment",
      entity_id: next.id,
      metadata: { post_id: postId, chip_id: chipId },
    });
    void emitTelemetryEvent({
      mode: "demo",
      event_type: "link.interacted",
      actor_user_id: MOCK_ME_ID,
      entity_type: "post",
      entity_id: postId,
      metadata: { interaction: "comment" },
    });
  });
  return { ok: true as const };
}

/**
 * Toggle whether the demo viewer follows a target profile (persisted overlay).
 * @param targetId - targetId argument
 * @returns Function result
 */
export async function toggleMockFollow(targetId: string): Promise<{ following: boolean }> {
  if (targetId === MOCK_ME_ID) throw new Error("Cannot follow self");
  const following = new Set(readFollowingIds());
  if (following.has(targetId)) {
    following.delete(targetId);
    writeJsonArray(FOLLOWING_KEY, [...following]);
    return { following: false };
  }

  following.add(targetId);
  writeJsonArray(FOLLOWING_KEY, [...following]);
  return { following: true };
}

/**
 * Persist a partial profile update for the demo viewer.
 * @param updates - updates argument
 * @returns Function result
 */
export async function updateMockProfile(
  updates: Pick<MockProfile, "display_name"> & {
    bio?: string | null;
    avatar_url?: string | null;
  },
): Promise<{ ok: true }> {
  writeJson(PROFILE_PATCH_KEY, updates);
  return { ok: true as const };
}

/**
 * Create a local demo post authored by the viewer and prepend it to the overlay.
 * @param input - input argument
 * @returns Function result
 */
export function addMockPost(input: {
  post_type: PostType;
  canvas_html: string;
  media_urls?: string[];
  bg_gradient: string;
}): MockPost {
  const posts = readJsonArray<MockPost>(LOCAL_POSTS_KEY);
  const post: MockPost = {
    id: makeUuid(),
    author_id: MOCK_ME_ID,
    post_type: input.post_type,
    canvas_html: input.canvas_html,
    media_urls: input.media_urls ?? [],
    bg_gradient: input.bg_gradient,
    created_at: new Date().toISOString(),
  };
  writeJsonArray(LOCAL_POSTS_KEY, [post, ...posts]);
  void import("@/features/admin/lib/emit").then(({ emitTelemetryEvent }) => {
    void emitTelemetryEvent({
      mode: "demo",
      event_type: "content.created",
      actor_user_id: MOCK_ME_ID,
      entity_type: "post",
      entity_id: post.id,
      metadata: { post_type: input.post_type },
    });
    void emitTelemetryEvent({
      mode: "demo",
      event_type: "link.created",
      actor_user_id: MOCK_ME_ID,
      entity_type: "post",
      entity_id: post.id,
      metadata: { path: `/p/${post.id}` },
    });
  });
  return post;
}

