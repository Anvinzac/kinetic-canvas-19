/**
 * Compact or standard count for profile/stats chrome
 *
 * Exports: formatCount, getProfileCompletion
 * Depends on: none (leaf module)
 */
/**
 * formatCount helper
 * @param n - n argument
 * @returns Computed value
 */
export function formatCount(n: number): string {
  return new Intl.NumberFormat("en", { notation: n > 999 ? "compact" : "standard" }).format(n);
}

/**
 * Profile completeness score (0–100) from display name, bio, avatar, and posts.
 * @param props - Component props
 * @returns Computed value
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
}): number {
  const checks = [displayName.trim().length > 0, !!bio?.trim(), !!avatar, posts > 0];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
