/**
 * Cross-feature social DTOs shared by live serverFns, demo mock store, and UI.
 * Shape mirrors Supabase rows used by the feed/post surfaces.
 */

export type PostType = "text" | "image" | "video" | "slideshow" | "link";

/**
 * @responsibility Describe a persisted kinetic post row used across feed, profile, and create.
 * @inputs Stored by Supabase `posts` or demo mock store
 * @outputs Normalized post fields for client rendering
 * @pure true
 */
export type SocialPost = {
  id: string;
  author_id: string;
  post_type: PostType;
  canvas_html: string;
  media_urls: string[] | null;
  bg_gradient: string | null;
  created_at: string;
};

/**
 * @responsibility Describe a public profile card used in feed chrome and discovery.
 * @inputs Supabase `profiles` or demo mock profiles
 * @outputs Display-safe profile fields
 * @pure true
 */
export type SocialProfile = {
  id: string;
  auth_user_id?: string | null;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio?: string | null;
  created_at?: string;
};

/** Profile rows that always include bio (settings / edit-profile). */
export type SocialProfileWithBio = SocialProfile & { bio: string | null };

/**
 * @responsibility Describe a like edge between a viewer and a post.
 * @pure true
 */
export type SocialLike = {
  post_id: string;
  user_id: string;
  created_at?: string;
};

/**
 * @responsibility Describe a chip/text comment attached to a post.
 * @pure true
 */
export type SocialComment = {
  id: string;
  post_id: string;
  user_id: string;
  chip_id: string;
  created_at: string;
};

/**
 * @responsibility Bundle the graph needed to render a feed or post player.
 * @pure true
 */
export type SocialFeedData = {
  posts: SocialPost[];
  profiles: SocialProfile[];
  likes: SocialLike[];
  comments: SocialComment[];
};

/**
 * @responsibility Bundle a single post page graph.
 * @pure true
 */
export type SocialPostData = {
  post: SocialPost;
  profiles: SocialProfile[];
  likes: SocialLike[];
  comments: SocialComment[];
};

/**
 * @responsibility Bundle profile page stats and the author's posts.
 * @pure true
 */
export type SocialProfileData = {
  profile: SocialProfile;
  posts: SocialPost[];
  followers: number;
  following: number;
  totalLikes: number;
  totalComments: number;
  engagementByPost: Record<string, { likes: number; comments: number }>;
};

/**
 * @responsibility Bundle the signed-in viewer's profile and follow set.
 * @pure true
 */
export type SocialMeData = {
  profile: SocialProfile;
  followingIds: string[];
  stats: { posts: number; followers: number; following: number };
};

/**
 * @responsibility Bundle discover-grid posts and their authors.
 * @pure true
 */
export type SocialDiscoverData = {
  posts: SocialPost[];
  profiles: SocialProfile[];
};

/**
 * @responsibility Bundle discover search hits for users and posts.
 * @pure true
 */
export type SocialSearchData = {
  users: SocialProfile[];
  posts: SocialPost[];
};

export type SocialNotificationKind = "like" | "comment" | "follow";

/**
 * @responsibility Describe one notification row for the activity screen.
 * @pure true
 */
export type SocialNotificationItem = {
  kind: SocialNotificationKind;
  actor: Pick<SocialProfile, "id" | "username" | "display_name" | "avatar_url"> | null;
  post_id?: string;
  post_preview?: string;
  chip_id?: string;
  created_at: string;
};

/**
 * @responsibility Bundle notification items for the activity screen.
 * @pure true
 */
export type SocialNotificationsData = {
  items: SocialNotificationItem[];
};
