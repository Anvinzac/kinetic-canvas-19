/**
 * Public barrel re-exports for this feature module.
 *
 * Exports: PostCard, PostCardProps, paginateText
 * Depends on: ./components/PostCard, ./components/PostCard, ./lib/paginate
 */

export { PostCard } from "./components/PostCard";
export type { PostCardProps } from "./components/PostCard";
export { paginateText } from "./lib/paginate";
export { WordSequenceText } from "./components/WordSequenceText";
export { PostCanvasBackdrop } from "./components/PostCanvasBackdrop";
export { getSlidingCanvasBackground } from "./lib/post-background";
export { getPageDuration, getUniformPageTextSize } from "./lib/playback-timing";
