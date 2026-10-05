/**
 * Viewport-windowed shell that mounts the heavy PostCard only when near the viewport.
 *
 * When the user scrolls far past a post (beyond 2 viewport heights), the PostCard
 * is unmounted and replaced with a lightweight placeholder that preserves the snap
 * behavior and visual footprint. This prevents memory buildup during endless scrolling
 * on mobile while keeping the UX identical for visible cards.
 *
 * Exports: PostCardShell
 * Depends on: PostCard, PostCardProps
 */

import { useEffect, useRef, useState, type ReactElement } from "react";
import { PostCard } from "./PostCard";
import type { PostCardProps } from "../types";

/**
 * How far beyond the viewport a card must be before it gets unmounted.
 * 200% = 2 full viewport heights above/below. Generous enough that scrolling
 * back feels instant (card remounts before the snap animation completes).
 */
const UNMOUNT_MARGIN = "200% 0% 200% 0%";

/**
 * Viewport-windowed wrapper for PostCard. Mounts the heavy player only when
 * the card is near the viewport; renders a cheap placeholder otherwise.
 * @param props - PostCard props (passed through to the real PostCard)
 * @returns Interactive PostCard when nearby, static placeholder when far
 */
export function PostCardShell(props: PostCardProps): ReactElement {
  const shellRef = useRef<HTMLElement>(null);
  const [isNearby, setIsNearby] = useState(false);
  // Before the first IntersectionObserver callback, mount every card so the
  // user never sees a placeholder flash on initial load. Once the observer
  // fires (synchronously in the first effect batch), far cards get unmounted.
  const [hasBeenObserved, setHasBeenObserved] = useState(false);

  useEffect(() => {
    const element = shellRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsNearby(entry.isIntersecting);
        setHasBeenObserved(true);
      },
      {
        rootMargin: UNMOUNT_MARGIN,
        // No threshold needed — we only care about entry/exit of the expanded zone.
        threshold: 0,
      },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Before the first observation: mount everything (avoid placeholder flash).
  // After first observation: only mount if the card is near the viewport.
  const shouldRenderCard = !hasBeenObserved || isNearby;

  return (
    <section
      ref={shellRef}
      data-status-snap-item="true"
      className="relative flex h-[100dvh] w-full snap-start snap-always items-center justify-center overflow-hidden bg-background"
    >
      {shouldRenderCard ? (
        <PostCard {...props} />
      ) : (
        <PostCardPlaceholder post={props.post} />
      )}
    </section>
  );
}

/**
 * Lightweight placeholder that preserves the visual footprint and snap behavior
 * of a PostCard without the heavy playback machinery. Shows only the gradient
 * background and author info — enough to maintain scroll rhythm.
 */
function PostCardPlaceholder({ post }: { post: PostCardProps["post"] }): ReactElement {
  return (
    <article
      className="relative h-full w-full overflow-hidden bg-[url('/canvas-fallback.svg')] bg-cover bg-center sm:aspect-[9/16] sm:h-[min(90dvh,764px)] sm:w-auto sm:shadow-[0_24px_90px_rgba(0,0,0,0.45)] sm:ring-1 sm:ring-white/10"
      aria-hidden="true"
    >
      {/* Static gradient backdrop — no animation, no canvas parsing */}
      {post.bg_gradient && (
        <div
          className="absolute inset-0"
          style={{ background: post.bg_gradient }}
        />
      )}
    </article>
  );
}
