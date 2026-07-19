/**
 * Demo seed barrel — re-exports profiles, posts, likes, comments, follows.
 *
 * Exports: MOCK_ME_ID, MOCK_* collections, Mock* types, follow helper
 * Depends on: seed/* modules
 */

export { MOCK_ME_ID, MOCK_ME_USERNAME, MOCK_PROFILES } from "./profiles";
export { MOCK_POSTS } from "./posts";
export { MOCK_LIKES } from "./likes";
export { MOCK_COMMENTS } from "./comments";
export { MOCK_FOLLOWS, follow } from "./follows";
export type {
  MockComment,
  MockDiscoverData,
  MockFeedData,
  MockFollow,
  MockLike,
  MockMeData,
  MockNotificationItem,
  MockNotificationsData,
  MockPost,
  MockPostData,
  MockProfile,
  MockProfileData,
  MockSearchData,
} from "./types";
