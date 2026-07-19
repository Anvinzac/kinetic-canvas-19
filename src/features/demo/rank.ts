/**
 * Module providing rankMockFeedPosts, buildEngagementByPost.
 *
 * Exports: rankMockFeedPosts, buildEngagementByPost
 * Depends on: ./seed
 */

import { MOCK_ME_ID, type MockComment, type MockLike, type MockPost } from "./seed";

const COLD_START_FOLLOWING_THRESHOLD = 3;

/**
 * Rank demo feed posts by relationship, engagement, and recency.
 * @param props - Component props
 * @returns Computed value
 */
export function rankMockFeedPosts({
  posts,
  likes,
  comments,
  followingIds,
}: {
  posts: MockPost[];
  likes: MockLike[];
  comments: MockComment[];
  followingIds: string[];
}): MockPost[] {
  const following = new Set(followingIds);
  const engagement = buildEngagementByPost(posts, likes, comments);
  const isColdStart = followingIds.length < COLD_START_FOLLOWING_THRESHOLD;

  return [...posts].sort((a, b) => {
    const scoreA = getMockFeedRankScore(a, engagement[a.id], following, isColdStart);
    const scoreB = getMockFeedRankScore(b, engagement[b.id], following, isColdStart);
    if (scoreA !== scoreB) return scoreB - scoreA;
    return b.created_at.localeCompare(a.created_at);
  });
}

/**
 * @responsibility Score one demo post for feed ordering (cold-start vs following-aware).
 * @note Live ranking includes a bot author boost; this demo scorer intentionally does not.
 */
function getMockFeedRankScore(
  post: MockPost,
  engagement: { likes: number; comments: number } | undefined,
  following: Set<string>,
  isColdStart: boolean,
) {
  const likes = engagement?.likes ?? 0;
  const comments = engagement?.comments ?? 0;
  const popularity = likes * 2 + comments * 3;
  const ageHours = Math.max(1, (Date.now() - new Date(post.created_at).getTime()) / 3_600_000);
  const recency = 24 / Math.sqrt(ageHours);

  if (isColdStart) return popularity * 100 + recency;

  const relationshipBoost =
    following.has(post.author_id) || post.author_id === MOCK_ME_ID ? 10_000 : 0;
  return relationshipBoost + popularity * 25 + recency;
}

/**
 * Tally likes and comments per post id for ranking and profile stats.
 * @param posts - posts argument
 * @param likes - likes argument
 * @param comments - comments argument
 * @returns Computed value
 */
export function buildEngagementByPost(posts: MockPost[], likes: MockLike[], comments: MockComment[]): Record<string, { likes: number; comments: number }> {
  const engagementByPost: Record<string, { likes: number; comments: number }> = {};
  for (const post of posts) engagementByPost[post.id] = { likes: 0, comments: 0 };
  for (const likeItem of likes) {
    if (engagementByPost[likeItem.post_id]) engagementByPost[likeItem.post_id].likes += 1;
  }
  for (const commentItem of comments) {
    if (engagementByPost[commentItem.post_id]) {
      engagementByPost[commentItem.post_id].comments += 1;
    }
  }
  return engagementByPost;
}
