/**
 * Demo feed/discover/search read APIs over the local mock store.
 *
 * Exports: getMockFeed, getMockPost, getMockDiscover, searchMock
 * Depends on: demo seed types, store, rank
 */

import { parseCanvas } from "@/lib/canvas";
import { rankMockFeedPosts } from "../rank";
import {
  type MockDiscoverData,
  type MockFeedData,
  type MockPostData,
  type MockSearchData,
} from "../seed";
import {
  getAllMockPosts,
  getAllMockProfiles,
  getMockComments,
  getMockLikes,
  readFollowingIds,
} from "../store";

const MOCK_FEED_LIMIT = 60;

/**
 * Build the ranked demo home feed graph (posts, profiles, likes, comments).
 * @returns Computed value
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
 * Load one demo post permalink graph, or throw when missing.
 * @param postId - postId argument
 * @returns Computed value
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
 * Build the demo discover grid (recent posts + newest profiles).
 * @returns Computed value
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
 * Search demo users and posts by username, display name, bio, or canvas text.
 * @param q - q argument
 * @returns Function result
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

