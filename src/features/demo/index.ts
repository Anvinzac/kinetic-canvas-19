/**
 * Public barrel re-exports for this feature module.
 *
 * Exports: addMockComment, addMockPost, getMockDiscover, getMockFeed, getMockMe, getMockNotifications, getMockPost, getMockProfile, searchMock, toggleMockFollow, toggleMockLike, updateMockProfile, MOCK_ME_ID, MOCK_ME_USERNAME, ...
 * Depends on: ./api, ./seed, ./store
 */

export {
  addMockComment,
  addMockPost,
  getMockDiscover,
  getMockFeed,
  getMockMe,
  getMockNotifications,
  getMockPost,
  getMockProfile,
  searchMock,
  toggleMockFollow,
  toggleMockLike,
  updateMockProfile,
} from "./api";
export {
  MOCK_ME_ID,
  MOCK_ME_USERNAME,
  type MockComment,
  type MockDiscoverData,
  type MockFeedData,
  type MockLike,
  type MockMeData,
  type MockNotificationItem,
  type MockNotificationsData,
  type MockPost,
  type MockPostData,
  type MockProfile,
  type MockProfileData,
  type MockSearchData,
} from "./seed";
export { resetMockRuntimeData } from "./store";
