/**
 * Demo profile, me, and notifications read APIs over the local mock store.
 *
 * Exports: getMockProfile, getMockMe, getMockNotifications
 * Depends on: demo seed, store, rank
 */

import { MOCK_ME_ID, MOCK_PROFILES, type MockNotificationItem, type MockMeData, type MockNotificationsData, type MockProfile, type MockProfileData } from "../seed";
import { buildEngagementByPost } from "../rank";
import {
  getAllMockPosts,
  getAllMockProfiles,
  getMockComments,
  getMockFollows,
  getMockLikes,
} from "../store";

/**
 * Load a demo public profile page graph by username, or throw when missing.
 * @param username - username argument
 * @returns Computed value
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
 * Load the signed-in demo viewer's profile, following ids, and stats.
 * @returns Computed value
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
 * Build the demo activity feed from likes, comments, and follows on the viewer's posts.
 * @returns Computed value
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

function toActor(profile: MockProfile | undefined): MockNotificationItem["actor"] {
  if (!profile) return null;
  return {
    id: profile.id,
    username: profile.username,
    display_name: profile.display_name,
    avatar_url: profile.avatar_url,
  };
}
