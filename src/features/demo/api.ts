/**
 * Compatibility shim — prefer `@/features/demo` or `@/features/demo/api`.
 *
 * Exports: re-exports demo/api public helpers
 * Depends on: features/demo/api
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
} from "./api/index";
