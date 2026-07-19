/**
 * Demo seed TypeScript aliases for mock social graphs.
 *
 * Exports: MockProfile, MockPost, MockLike, MockComment, MockFollow, feed/profile/notification data aliases
 * Depends on: shared/types Social* shapes
 */

import type {
  SocialComment,
  SocialDiscoverData,
  SocialFeedData,
  SocialLike,
  SocialMeData,
  SocialNotificationItem,
  SocialNotificationsData,
  SocialPost,
  SocialPostData,
  SocialProfile,
  SocialProfileData,
  SocialSearchData,
} from "@/shared/types";

/** @deprecated Prefer SocialProfile from `@/shared/types`
 * @responsibility Demo profile row shape (includes seed-only auth/bio/created_at fields). */
export type MockProfile = SocialProfile & {
  auth_user_id: string | null;
  bio: string | null;
  created_at: string;
};

/** @deprecated Prefer SocialPost from `@/shared/types`
 * @responsibility Demo post row shape used by seed data and local overlays. */
export type MockPost = SocialPost;

/** @deprecated Prefer SocialLike from `@/shared/types`
 * @responsibility Demo like edge including created_at for notification ordering. */
export type MockLike = SocialLike & { created_at: string };

/** @deprecated Prefer SocialComment from `@/shared/types`
 * @responsibility Demo comment row used by seed bursts and local overlays. */
export type MockComment = SocialComment;

/** @responsibility Follow edge between two demo profiles. */
export type MockFollow = {
  follower_id: string;
  following_id: string;
  created_at: string;
};

/** @deprecated Prefer SocialFeedData from `@/shared/types`
 * @responsibility Bundle returned by getMockFeed. */
export type MockFeedData = SocialFeedData;

/** @deprecated Prefer SocialPostData from `@/shared/types`
 * @responsibility Bundle returned by getMockPost. */
export type MockPostData = SocialPostData;

/** @deprecated Prefer SocialProfileData from `@/shared/types`
 * @responsibility Bundle returned by getMockProfile. */
export type MockProfileData = SocialProfileData;

/** @deprecated Prefer SocialMeData from `@/shared/types`
 * @responsibility Bundle returned by getMockMe. */
export type MockMeData = SocialMeData;

/** @deprecated Prefer SocialDiscoverData from `@/shared/types`
 * @responsibility Bundle returned by getMockDiscover. */
export type MockDiscoverData = SocialDiscoverData;

/** @deprecated Prefer SocialSearchData from `@/shared/types`
 * @responsibility Bundle returned by searchMock. */
export type MockSearchData = SocialSearchData;

/** @deprecated Prefer SocialNotificationItem from `@/shared/types`
 * @responsibility One notification row in the demo activity feed. */
export type MockNotificationItem = SocialNotificationItem;

/** @deprecated Prefer SocialNotificationsData from `@/shared/types`
 * @responsibility Bundle returned by getMockNotifications. */
export type MockNotificationsData = SocialNotificationsData;

