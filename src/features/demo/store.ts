/**
 * Module providing PROFILE_PATCH_KEY, LOCAL_POSTS_KEY, LOCAL_COMMENTS_KEY, LIKED_POSTS_KEY.
 *
 * Exports: PROFILE_PATCH_KEY, LOCAL_POSTS_KEY, LOCAL_COMMENTS_KEY, LIKED_POSTS_KEY, FOLLOWING_KEY, resetMockRuntimeData, getAllMockProfiles, getAllMockPosts, getMockLikes, getMockComments, getMockFollows, readLikedPostIds, readFollowingIds, readJson, ...
 * Depends on: ./seed
 */

import {
  follow,
  MOCK_COMMENTS,
  MOCK_FOLLOWS,
  MOCK_LIKES,
  MOCK_ME_ID,
  MOCK_POSTS,
  MOCK_PROFILES,
  type MockComment,
  type MockPost,
  type MockProfile,
} from "./seed";

export const PROFILE_PATCH_KEY = "kinetic.demo.profile.patch";
export const LOCAL_POSTS_KEY = "kinetic.demo.posts";
export const LOCAL_COMMENTS_KEY = "kinetic.demo.comments";
export const LIKED_POSTS_KEY = "kinetic.demo.likedPosts";
export const FOLLOWING_KEY = "kinetic.demo.following";

/**
 * Clear all demo localStorage overlays so seed data is the sole source again.
 * @returns Function result
 */
export function resetMockRuntimeData(): void {
  removeStorage(PROFILE_PATCH_KEY);
  removeStorage(LOCAL_POSTS_KEY);
  removeStorage(LOCAL_COMMENTS_KEY);
  removeStorage(LIKED_POSTS_KEY);
  removeStorage(FOLLOWING_KEY);
}

/**
 * Return profiles with the demo viewer patch overlay applied.
 * @returns Computed value
 */
export function getAllMockProfiles(): MockProfile[] {
  const patch = readJson<Partial<MockProfile>>(PROFILE_PATCH_KEY, {});
  return MOCK_PROFILES.map((profile) =>
    profile.id === MOCK_ME_ID ? cloneProfile({ ...profile, ...patch }): cloneProfile(profile),
  );
}

/**
 * Return local + seed posts newest-first (local overlays first).
 * @returns Computed value
 */
export function getAllMockPosts(): MockPost[] {
  return [...readJsonArray<MockPost>(LOCAL_POSTS_KEY), ...MOCK_POSTS]
    .map(clonePost)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/**
 * Merge seed likes with the demo viewer's liked-posts overlay.
 * @returns Computed value
 */
export function getMockLikes(): Array<{ post_id: string; user_id: string; created_at: string }> {
  const demoLikes = readLikedPostIds().map((postId) => ({
    post_id: postId,
    user_id: MOCK_ME_ID,
    created_at: new Date().toISOString(),
  }));
  return [...MOCK_LIKES.filter((likeItem) => likeItem.user_id !== MOCK_ME_ID), ...demoLikes];
}

/**
 * Merge seed comments with locally added demo comments, oldest-first.
 * @returns Computed value
 */
export function getMockComments(): MockComment[] {
  return [...MOCK_COMMENTS, ...readJsonArray<MockComment>(LOCAL_COMMENTS_KEY)]
    .map((commentItem) => ({ ...commentItem }))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/**
 * Merge seed follows with the demo viewer's following overlay.
 * @returns Computed value
 */
export function getMockFollows(): ReturnType<typeof follow>[] {
  const demoFollows = readFollowingIds().map((followingId) =>
    follow(MOCK_ME_ID, followingId, "2026-06-01T09:00:00.000Z"),
  );
  return [
    ...MOCK_FOLLOWS.filter((followItem) => followItem.follower_id !== MOCK_ME_ID),
    ...demoFollows,
  ];
}

/**
 * Read liked post ids from storage, or seed defaults for the demo viewer.
 * @returns Computed value
 */
export function readLikedPostIds(): string[] {
  if (hasStorageValue(LIKED_POSTS_KEY)) return readJsonArray<string>(LIKED_POSTS_KEY);
  return MOCK_LIKES.filter((likeItem) => likeItem.user_id === MOCK_ME_ID).map(
    (likeItem) => likeItem.post_id,
  );
}

/**
 * Read following ids from storage, or seed defaults for the demo viewer.
 * @returns Computed value
 */
export function readFollowingIds(): string[] {
  if (hasStorageValue(FOLLOWING_KEY)) return readJsonArray<string>(FOLLOWING_KEY);
  return MOCK_FOLLOWS.filter((followItem) => followItem.follower_id === MOCK_ME_ID).map(
    (followItem) => followItem.following_id,
  );
}

/**
 * Parse a JSON value from localStorage, falling back and clearing on error.
 * @param key - key argument
 * @param fallback - fallback argument
 * @returns Computed value
 */
export function readJson<T>(key: string, fallback: T): T {
  const raw = getStorage()?.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    removeStorage(key);
    return fallback;
  }
}

/**
 * Write a JSON value to localStorage when available.
 * @param key - key argument
 * @param value - value argument
 * @returns Computed value
 */
export function writeJson(key: string, value: unknown): void {
  getStorage()?.setItem(key, JSON.stringify(value));
}

/**
 * Read a JSON array from localStorage (empty array when missing/invalid).
 * @param key - key argument
 * @returns Computed value
 */
export function readJsonArray<T>(key: string): T[] {
  const value = readJson<T[]>(key, []);
  return Array.isArray(value) ? value : [];
}

/**
 * Write a JSON array to localStorage when available.
 * @param key - key argument
 * @param value - value argument
 * @returns Computed value
 */
export function writeJsonArray<T>(key: string, value: T[]): void {
  writeJson(key, value);
}

/**
 * Remove a localStorage key when available.
 * @param key - key argument
 * @returns Function result
 */
export function removeStorage(key: string): void {
  getStorage()?.removeItem(key);
}

/**
 * Report whether a localStorage key is present (including empty string).
 * @param key - key argument
 * @returns Boolean result
 */
export function hasStorageValue(key: string): boolean {
  return getStorage()?.getItem(key) !== null;
}

/**
 * Access browser localStorage when available (SSR-safe).
 * @returns Computed value
 */
export function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

/**
 * Allocate a UUID for locally created demo rows (crypto when available).
 * @returns Computed value
 */
export function makeUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  const suffix = Date.now().toString(16).padStart(12, "0").slice(-12);
  return `10000000-0000-4000-8000-${suffix}`;
}

function cloneProfile(profile: MockProfile): MockProfile {
  return { ...profile };
}

function clonePost(post: MockPost): MockPost {
  return {
    ...post,
    media_urls: post.media_urls ? [...post.media_urls] : null,
  };
}
