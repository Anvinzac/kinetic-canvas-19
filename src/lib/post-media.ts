export const HANOI_MORNING_GIF =
  "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExdjlvNjVwMWYxeHQ2aGloY2N4czJqeDZvY2Rwd21ubWF5eHhhbjhhOSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/tZZTCbdO5cRUVUULFL/giphy.gif";

export const DEMO_STATUS_PHOTOS = {
  hanoiMorning: HANOI_MORNING_GIF,
  conversation:
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80",
  vietnameseRhythm:
    "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1400&q=80",
  smallIdea:
    "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1400&q=80",
  denseInfo:
    "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=1400&q=80",
  dinnerTable:
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=80",
} as const;

type PostMediaSource = {
  post_type: string;
  media_urls?: string[] | null;
};

export function isPhotoMediaUrl(url: string) {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(trimmed)) return false;
  return (
    /\.(jpe?g|png|gif|webp|avif|bmp)(\?|$)/i.test(trimmed) ||
    /images\.unsplash\.com|images\.pexels\.com|i\.pravatar\.cc|giphy\.com/i.test(trimmed)
  );
}

/** GIF / Giphy backdrops already animate — skip Ken Burns pan/zoom on top. */
export function isAnimatedPhotoUrl(url: string) {
  const trimmed = url.trim();
  return /\.gif(\?|$)/i.test(trimmed) || /giphy\.com/i.test(trimmed);
}

/** First image URL on a post — used even when post_type drifted to "text" in the DB. */
export function getPostPhotoUrl(post: PostMediaSource) {
  for (const url of post.media_urls ?? []) {
    if (url && isPhotoMediaUrl(url)) return url;
  }
  return null;
}

export function hasPostPhotoBackdrop(post: PostMediaSource) {
  return Boolean(getPostPhotoUrl(post));
}
