/**
 * Post-player domain types for the feed kinetic status card.
 *
 * Exports: Profile, Post, Comment, FlowComment, CommentStory, PostCardProps
 * Depends on: none
 */

export type Profile = { id: string; username: string; display_name: string; avatar_url: string | null };

export type Post = {
  id: string;
  author_id: string;
  post_type: string;
  canvas_html: string;
  media_urls: string[] | null;
  bg_gradient: string | null;
  created_at: string;
};

export type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  chip_id: string;
  created_at: string;
};

export type FlowComment = { key: string; chip: string; created_at: string; user_id: string };

export type CommentStory = {
  id: string;
  text: string;
  created_at: string;
  index: number;
  user_id: string;
};

/**
 * Props for the full-screen kinetic status player.
 */
export type PostCardProps = {
  post: Post;
  author?: Profile;
  profilesById: Map<string, Profile>;
  currentUserId: string | null;
  likes: number;
  comments: Comment[];
  liked: boolean;
  onLike: () => void;
  onComment: (chip: string) => void;
};
