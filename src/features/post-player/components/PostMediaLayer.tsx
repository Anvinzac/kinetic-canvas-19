/**
 * Photo, video, and slideshow media layer with optional vignette.
 *
 * Exports: PostMediaLayer
 * Depends on: framer-motion, KenBurnsPhoto, post-media helpers
 */

import { AnimatePresence, motion } from "framer-motion";
import type { ReactElement, Ref } from "react";
import { KenBurnsPhoto } from "@/components/KenBurnsPhoto";
import { isAnimatedPhotoUrl, isPhotoMediaUrl } from "@/lib/post-media";

export type PostMediaLayerProps = {
  postId: string;
  postType: string;
  media: string[];
  slide: number;
  photoUrl: string | null;
  hasPhotoBackdrop: boolean;
  isPaused: boolean;
  staticCanvasBackground: string | null | undefined;
  videoRef: Ref<HTMLVideoElement>;
};

/**
 * Render photo/video/slideshow media under the kinetic text.
 * @param props - PostMediaLayerProps fields
 * @returns Rendered UI
 */
export function PostMediaLayer({
  postId,
  postType,
  media,
  slide,
  photoUrl,
  hasPhotoBackdrop,
  isPaused,
  staticCanvasBackground,
  videoRef,
}: PostMediaLayerProps): ReactElement | null {
  return (
    <>
      {photoUrl && (
        <KenBurnsPhoto
          src={photoUrl}
          seed={postId}
          paused={isPaused || isAnimatedPhotoUrl(photoUrl)}
          fallbackBackground={staticCanvasBackground}
        />
      )}
      {postType === "video" && media[0] && !photoUrl && (
        <video
          ref={videoRef}
          src={media[0]}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 size-full object-cover"
        />
      )}
      {postType === "slideshow" && media[slide] && isPhotoMediaUrl(media[slide]) && (
        <AnimatePresence mode="wait">
          <motion.div
            key={slide}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0"
          >
            <KenBurnsPhoto
              src={media[slide]}
              seed={`${postId}-${slide}`}
              paused={isPaused || isAnimatedPhotoUrl(media[slide])}
              fallbackBackground={staticCanvasBackground}
            />
          </motion.div>
        </AnimatePresence>
      )}
      {postType !== "text" && hasPhotoBackdrop && (
        <>
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_32%,rgba(0,0,0,0.38)_100%)]"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-b from-black/38 via-black/22 to-black/68"
          />
        </>
      )}
    </>
  );
}
