/**
 * Compact or standard count for profile/stats chrome.
 * @pure true
 */
export function formatCount(n: number) {
  return new Intl.NumberFormat("en", { notation: n > 999 ? "compact" : "standard" }).format(n);
}

/**
 * Profile completeness score (0–100) from display name, bio, avatar, and posts.
 * @pure true
 */
export function getProfileCompletion({
  displayName,
  bio,
  avatar,
  posts,
}: {
  displayName: string;
  bio: string | null;
  avatar: string | null;
  posts: number;
}) {
  const checks = [displayName.trim().length > 0, !!bio?.trim(), !!avatar, posts > 0];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
