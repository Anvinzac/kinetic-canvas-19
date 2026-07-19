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
 * @responsibility Clear all demo localStorage overlays so seed data is the sole source again.
 */
export function resetMockRuntimeData() {
  removeStorage(PROFILE_PATCH_KEY);
  removeStorage(LOCAL_POSTS_KEY);
  removeStorage(LOCAL_COMMENTS_KEY);
  removeStorage(LIKED_POSTS_KEY);
  removeStorage(FOLLOWING_KEY);
}

/**
 * @responsibility Return profiles with the demo viewer patch overlay applied.
 */
export function getAllMockProfiles() {
  const patch = readJson<Partial<MockProfile>>(PROFILE_PATCH_KEY, {});
  return MOCK_PROFILES.map((profile) =>
    profile.id === MOCK_ME_ID ? cloneProfile({ ...profile, ...patch }) : cloneProfile(profile),
  );
}

/**
 * @responsibility Return local + seed posts newest-first (local overlays first).
 */
export function getAllMockPosts() {
  return [...readJsonArray<MockPost>(LOCAL_POSTS_KEY), ...MOCK_POSTS]
    .map(clonePost)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/**
 * @responsibility Merge seed likes with the demo viewer's liked-posts overlay.
 */
export function getMockLikes() {
  const demoLikes = readLikedPostIds().map((postId) => ({
    post_id: postId,
    user_id: MOCK_ME_ID,
    created_at: new Date().toISOString(),
  }));
  return [...MOCK_LIKES.filter((likeItem) => likeItem.user_id !== MOCK_ME_ID), ...demoLikes];
}

/**
 * @responsibility Merge seed comments with locally added demo comments, oldest-first.
 */
export function getMockComments() {
  return [...MOCK_COMMENTS, ...readJsonArray<MockComment>(LOCAL_COMMENTS_KEY)]
    .map((commentItem) => ({ ...commentItem }))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/**
 * @responsibility Merge seed follows with the demo viewer's following overlay.
 */
export function getMockFollows() {
  const demoFollows = readFollowingIds().map((followingId) =>
    follow(MOCK_ME_ID, followingId, "2026-06-01T09:00:00.000Z"),
  );
  return [
    ...MOCK_FOLLOWS.filter((followItem) => followItem.follower_id !== MOCK_ME_ID),
    ...demoFollows,
  ];
}

/**
 * @responsibility Read liked post ids from storage, or seed defaults for the demo viewer.
 */
export function readLikedPostIds() {
  if (hasStorageValue(LIKED_POSTS_KEY)) return readJsonArray<string>(LIKED_POSTS_KEY);
  return MOCK_LIKES.filter((likeItem) => likeItem.user_id === MOCK_ME_ID).map(
    (likeItem) => likeItem.post_id,
  );
}

/**
 * @responsibility Read following ids from storage, or seed defaults for the demo viewer.
 */
export function readFollowingIds() {
  if (hasStorageValue(FOLLOWING_KEY)) return readJsonArray<string>(FOLLOWING_KEY);
  return MOCK_FOLLOWS.filter((followItem) => followItem.follower_id === MOCK_ME_ID).map(
    (followItem) => followItem.following_id,
  );
}

/**
 * @responsibility Parse a JSON value from localStorage, falling back and clearing on error.
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
 * @responsibility Write a JSON value to localStorage when available.
 */
export function writeJson(key: string, value: unknown) {
  getStorage()?.setItem(key, JSON.stringify(value));
}

/**
 * @responsibility Read a JSON array from localStorage (empty array when missing/invalid).
 */
export function readJsonArray<T>(key: string) {
  const value = readJson<T[]>(key, []);
  return Array.isArray(value) ? value : [];
}

/**
 * @responsibility Write a JSON array to localStorage when available.
 */
export function writeJsonArray<T>(key: string, value: T[]) {
  writeJson(key, value);
}

/**
 * @responsibility Remove a localStorage key when available.
 */
export function removeStorage(key: string) {
  getStorage()?.removeItem(key);
}

/**
 * @responsibility Report whether a localStorage key is present (including empty string).
 */
export function hasStorageValue(key: string) {
  return getStorage()?.getItem(key) !== null;
}

/**
 * @responsibility Access browser localStorage when available (SSR-safe).
 */
export function getStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

/**
 * @responsibility Allocate a UUID for locally created demo rows (crypto when available).
 */
export function makeUuid() {
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
