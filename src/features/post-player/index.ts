/**
 * Public barrel re-exports for this feature module.
 *
 * Exports: PostCard, PostCardShell, PostCardProps, paginateText
 * Depends on: ./components/PostCard, ./components/PostCardShell, ./lib/paginate
 */

export { PostCard } from "./components/PostCard";
export { PostCardShell } from "./components/PostCardShell";
export type { PostCardProps } from "./components/PostCard";
export { paginateText } from "./lib/paginate";
export { WordSequenceText } from "./components/WordSequenceText";
export { PostCanvasBackdrop } from "./components/PostCanvasBackdrop";
export { getSlidingCanvasBackground } from "./lib/post-background";
export { getPageDuration, getUniformPageTextSize } from "./lib/playback-timing";
