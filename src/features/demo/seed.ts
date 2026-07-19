/**
 * Compatibility shim — prefer `@/features/demo/seed` or `@/features/demo`.
 *
 * Exports: re-exports all seed modules
 * Depends on: features/demo/seed/*
 */

export {
  MOCK_ME_ID,
  MOCK_ME_USERNAME,
  MOCK_PROFILES,
  MOCK_POSTS,
  MOCK_LIKES,
  MOCK_COMMENTS,
  MOCK_FOLLOWS,
  follow,
  type MockComment,
  type MockDiscoverData,
  type MockFeedData,
  type MockFollow,
  type MockLike,
  type MockMeData,
  type MockNotificationItem,
  type MockNotificationsData,
  type MockPost,
  type MockPostData,
  type MockProfile,
  type MockProfileData,
  type MockSearchData,
} from "./seed/index";
