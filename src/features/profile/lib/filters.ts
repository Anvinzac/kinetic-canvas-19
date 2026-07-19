/**
 * Profile feed filtering, sorting, and Vietnam-timezone prioritization helpers.
 *
 * Exports: PostKind, PostFilter, PostSort, Engagement, POST_KINDS, getSortedPosts,
 *   prioritizeVietnamYesterdayPosts, getVietnamDateKey, seededHash, getTypeCounts
 * Depends on: @/lib/mock-data MockPost
 */

import type { MockPost } from "@/lib/mock-data";

export type PostKind = "text" | "image" | "video" | "slideshow" | "link";
export type PostFilter = "all" | PostKind;
export type PostSort = "recent" | "popular" | "shuffle";
export type Engagement = { likes: number; comments: number };

/** Known post type ids used for filter chips and type counts. */
export const POST_KINDS: PostKind[] = ["text", "image", "video", "slideshow", "link"];

/**
 * Sort (or leave) posts for the profile feed lane.
 * @param posts - Posts in the profile lane
 * @param sort - recent | popular | shuffle
 * @param engagementByPost - Like/comment tallies keyed by post id
 * @param shuffleSeed - Seed for deterministic shuffle ordering
 * @returns Posts ordered for the active sort mode
 */
export function getSortedPosts(
  posts: MockPost[],
  sort: PostSort,
  engagementByPost: Record<string, Engagement>,
  shuffleSeed: number,
): MockPost[] {
  if (sort === "popular") {
    return [...posts].sort((a, b) => {
      const scoreA = (engagementByPost[a.id]?.likes ?? 0) + (engagementByPost[a.id]?.comments ?? 0);
      const scoreB = (engagementByPost[b.id]?.likes ?? 0) + (engagementByPost[b.id]?.comments ?? 0);
      return scoreB - scoreA;
    });
  }
  if (sort === "shuffle") {
    return [...posts].sort((a, b) => {
      const hashA = seededHash(a.id, shuffleSeed);
      const hashB = seededHash(b.id, shuffleSeed);
      return hashA - hashB;
    });
  }
  // recent (default) - already sorted by created_at desc from the data source
  return posts;
}

/**
 * For the demo bot profile, surface yesterday's Vietnam-timezone posts first
 * when there are at least three of them.
 * @param posts - Profile posts to reorder
 * @returns Reordered posts, or the input list when the threshold is not met
 */
export function prioritizeVietnamYesterdayPosts(posts: MockPost[]): MockPost[] {
  const yesterdayKey = getVietnamDateKey(Date.now() - 24 * 60 * 60 * 1000);
  const yesterdayPosts = posts.filter(
    (post) => getVietnamDateKey(post.created_at) === yesterdayKey,
  );
  if (yesterdayPosts.length < 3) return posts;

  const yesterdayIds = new Set(yesterdayPosts.map((post) => post.id));
  return [
    ...yesterdayPosts.sort((a, b) => b.created_at.localeCompare(a.created_at)),
    ...posts.filter((post) => !yesterdayIds.has(post.id)),
  ];
}

/**
 * Calendar date key (YYYY-MM-DD) in Asia/Ho_Chi_Minh.
 * @param value - ISO date string or epoch millis
 * @returns YYYY-MM-DD in Vietnam timezone
 */
export function getVietnamDateKey(value: string | number): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Deterministic hash for seeded shuffle ordering.
 * @param value - String to hash (usually post id)
 * @param seed - Shuffle seed
 * @returns Unsigned 32-bit hash
 */
export function seededHash(value: string, seed: number): number {
  let h = seed * 2654435761;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Count posts by kind for filter chip badges.
 * @param posts - Posts to tally
 * @returns Counts keyed by PostKind
 */
export function getTypeCounts(posts: MockPost[]): Record<PostKind, number> {
  const counts: Record<PostKind, number> = { text: 0, image: 0, video: 0, slideshow: 0, link: 0 };
  for (const post of posts) {
    if (POST_KINDS.includes(post.post_type as PostKind)) counts[post.post_type as PostKind] += 1;
  }
  return counts;
}
