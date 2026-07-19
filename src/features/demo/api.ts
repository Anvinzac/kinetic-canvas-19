import { parseCanvas } from "@/lib/canvas";
import type { PostType } from "@/shared/types";
import { buildEngagementByPost, rankMockFeedPosts } from "./rank";
import {
  MOCK_ME_ID,
  MOCK_PROFILES,
  type MockComment,
  type MockDiscoverData,
  type MockFeedData,
  type MockMeData,
  type MockNotificationItem,
  type MockNotificationsData,
  type MockPost,
  type MockPostData,
  type MockProfile,
  type MockProfileData,
  type MockSearchData,
} from "./seed";
import {
  FOLLOWING_KEY,
  getAllMockPosts,
  getAllMockProfiles,
  getMockComments,
  getMockFollows,
  getMockLikes,
  LIKED_POSTS_KEY,
  LOCAL_COMMENTS_KEY,
  LOCAL_POSTS_KEY,
  makeUuid,
  PROFILE_PATCH_KEY,
  readFollowingIds,
  readJsonArray,
  readLikedPostIds,
  writeJson,
  writeJsonArray,
} from "./store";

const MOCK_FEED_LIMIT = 60;

/**
 * @responsibility Build the ranked demo home feed graph (posts, profiles, likes, comments).
 */
export function getMockFeed(): MockFeedData {
  const likes = getMockLikes();
  const comments = getMockComments();
  const posts = rankMockFeedPosts({
    posts: getAllMockPosts(),
    likes,
    comments,
    followingIds: readFollowingIds(),
  }).slice(0, MOCK_FEED_LIMIT);
  const postIds = new Set(posts.map((post) => post.id));

  return {
    posts,
    profiles: getAllMockProfiles(),
    likes: likes.filter((likeItem) => postIds.has(likeItem.post_id)),
    comments: comments.filter((commentItem) => postIds.has(commentItem.post_id)),
  };
}

/**
 * @responsibility Load one demo post permalink graph, or throw when missing.
 */
export function getMockPost(postId: string): MockPostData {
  const post = getAllMockPosts().find((item) => item.id === postId);
  if (!post) throw new Error("Post not found");

  const likes = getMockLikes().filter((likeItem) => likeItem.post_id === post.id);
  const comments = getMockComments().filter((commentItem) => commentItem.post_id === post.id);
  const profileIds = new Set([
    post.author_id,
    ...comments.map((commentItem) => commentItem.user_id),
  ]);
  const profiles = getAllMockProfiles().filter((profile) => profileIds.has(profile.id));

  return {
    post,
    profiles,
    likes,
    comments,
  };
}

/**
 * @responsibility Build the demo discover grid (recent posts + newest profiles).
 */
export function getMockDiscover(): MockDiscoverData {
  return {
    posts: getAllMockPosts().slice(0, 36),
    profiles: getAllMockProfiles()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 12),
  };
}

/**
 * @responsibility Search demo users and posts by username, display name, bio, or canvas text.
 */
export function searchMock(q: string): MockSearchData {
  const needle = q.trim().toLowerCase();
  if (!needle) return { users: [], posts: [] };

  const profiles = getAllMockProfiles();
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const users = profiles
    .filter(
      (profile) =>
        profile.username.toLowerCase().includes(needle) ||
        profile.display_name.toLowerCase().includes(needle) ||
        (profile.bio ?? "").toLowerCase().includes(needle),
    )
    .slice(0, 20);

  const posts = getAllMockPosts()
    .filter((post) => {
      const text = parseCanvas(post.canvas_html).text.toLowerCase();
      const author = profileById.get(post.author_id);
      return (
        text.includes(needle) ||
        post.post_type.includes(needle) ||
        author?.username.toLowerCase().includes(needle) ||
        author?.display_name.toLowerCase().includes(needle)
      );
    })
    .slice(0, 30);

  return { users, posts };
}

/**
 * @responsibility Load a demo public profile page graph by username, or throw when missing.
 */
export function getMockProfile(username: string): MockProfileData {
  const profile = getAllMockProfiles().find(
    (item) => item.username.toLowerCase() === username.toLowerCase(),
  );
  if (!profile) throw new Error("Not found");

  const posts = getAllMockPosts().filter((post) => post.author_id === profile.id);
  const postIds = new Set(posts.map((post) => post.id));
  const likes = getMockLikes().filter((likeItem) => postIds.has(likeItem.post_id));
  const comments = getMockComments().filter((commentItem) => postIds.has(commentItem.post_id));
  const follows = getMockFollows();
  const engagementByPost = buildEngagementByPost(posts, likes, comments);

  return {
    profile,
    posts,
    followers: follows.filter((followItem) => followItem.following_id === profile.id).length,
    following: follows.filter((followItem) => followItem.follower_id === profile.id).length,
    totalLikes: likes.length,
    totalComments: comments.length,
    engagementByPost,
  };
}

/**
 * @responsibility Load the signed-in demo viewer's profile, following ids, and stats.
 */
export function getMockMe(): MockMeData {
  const profile = getAllMockProfiles().find((item) => item.id === MOCK_ME_ID) ?? MOCK_PROFILES[0];
  const posts = getAllMockPosts().filter((post) => post.author_id === profile.id);
  const follows = getMockFollows();
  const followingIds = follows
    .filter((followItem) => followItem.follower_id === profile.id)
    .map((followItem) => followItem.following_id);

  return {
    profile,
    followingIds,
    stats: {
      posts: posts.length,
      followers: follows.filter((followItem) => followItem.following_id === profile.id).length,
      following: followingIds.length,
    },
  };
}

/**
 * @responsibility Build the demo activity feed from likes, comments, and follows on the viewer's posts.
 */
export function getMockNotifications(): MockNotificationsData {
  const myPosts = getAllMockPosts().filter((post) => post.author_id === MOCK_ME_ID);
  const postIds = new Set(myPosts.map((post) => post.id));
  const postById = new Map(myPosts.map((post) => [post.id, post]));
  const actorById = new Map(getAllMockProfiles().map((profile) => [profile.id, profile]));
  const items: MockNotificationItem[] = [];

  getMockLikes()
    .filter((likeItem) => postIds.has(likeItem.post_id) && likeItem.user_id !== MOCK_ME_ID)
    .forEach((likeItem) => {
      items.push({
        kind: "like",
        actor: toActor(actorById.get(likeItem.user_id)),
        post_id: likeItem.post_id,
        post_preview: postById.get(likeItem.post_id)?.canvas_html,
        created_at: likeItem.created_at,
      });
    });

  getMockComments()
    .filter((commentItem) => postIds.has(commentItem.post_id) && commentItem.user_id !== MOCK_ME_ID)
    .forEach((commentItem) => {
      items.push({
        kind: "comment",
        actor: toActor(actorById.get(commentItem.user_id)),
        post_id: commentItem.post_id,
        post_preview: postById.get(commentItem.post_id)?.canvas_html,
        chip_id: commentItem.chip_id,
        created_at: commentItem.created_at,
      });
    });

  getMockFollows()
    .filter((followItem) => followItem.following_id === MOCK_ME_ID)
    .forEach((followItem) => {
      items.push({
        kind: "follow",
        actor: toActor(actorById.get(followItem.follower_id)),
        created_at: followItem.created_at,
      });
    });

  return {
    items: items.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 60),
  };
}

/**
 * @responsibility Toggle whether the demo viewer likes a post (persisted overlay).
 */
export async function toggleMockLike(postId: string) {
  const liked = new Set(readLikedPostIds());
  if (liked.has(postId)) {
    liked.delete(postId);
    writeJsonArray(LIKED_POSTS_KEY, [...liked]);
    return { liked: false };
  }

  liked.add(postId);
  writeJsonArray(LIKED_POSTS_KEY, [...liked]);
  return { liked: true };
}

/**
 * @responsibility Append a chip comment from the demo viewer onto a post (persisted overlay).
 */
export async function addMockComment(postId: string, chipId: string) {
  const comments = readJsonArray<MockComment>(LOCAL_COMMENTS_KEY);
  const next: MockComment = {
    id: makeUuid(),
    post_id: postId,
    user_id: MOCK_ME_ID,
    chip_id: chipId,
    created_at: new Date().toISOString(),
  };
  writeJsonArray(LOCAL_COMMENTS_KEY, [...comments, next]);
  return { ok: true as const };
}

/**
 * @responsibility Toggle whether the demo viewer follows a target profile (persisted overlay).
 */
export async function toggleMockFollow(targetId: string) {
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
 * @responsibility Persist a partial profile update for the demo viewer.
 */
export async function updateMockProfile(
  updates: Pick<MockProfile, "display_name"> & {
    bio?: string | null;
    avatar_url?: string | null;
  },
) {
  writeJson(PROFILE_PATCH_KEY, updates);
  return { ok: true as const };
}

/**
 * @responsibility Create a local demo post authored by the viewer and prepend it to the overlay.
 */
export function addMockPost(input: {
  post_type: PostType;
  canvas_html: string;
  media_urls?: string[];
  bg_gradient: string;
}) {
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
  return post;
}

function toActor(profile: MockProfile | undefined): MockNotificationItem["actor"] {
  if (!profile) return null;
  return {
    id: profile.id,
    username: profile.username,
    display_name: profile.display_name,
    avatar_url: profile.avatar_url,
  };
}
