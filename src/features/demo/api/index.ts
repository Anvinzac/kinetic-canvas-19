/**
 * Demo mock API barrel — feed, profile, and mutation helpers.
 *
 * Exports: getMockFeed, getMockProfile, toggleMockLike, ...
 * Depends on: demo/api/feed, profile, mutations
 */

export {
  getMockDiscover,
  getMockFeed,
  getMockPost,
  searchMock,
} from "./feed";
export {
  getMockMe,
  getMockNotifications,
  getMockProfile,
} from "./profile";
export {
  addMockComment,
  addMockPost,
  toggleMockFollow,
  toggleMockLike,
  updateMockProfile,
} from "./mutations";
