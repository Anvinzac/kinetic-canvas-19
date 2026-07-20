/**
 * Resolved photo / scene / pattern / sliding backgrounds for a post canvas.
 *
 * Exports: getPostCanvasVisuals
 * Depends on: post-media, canvas themes, post-background
 */

import { getPostPhotoUrl, hasPostPhotoBackdrop } from "@/lib/post-media";
import type { CanvasSpec } from "@/features/canvas";
import { getCanvasPatternTheme } from "@/features/canvas";
import { getCanvasSceneTheme } from "@/features/canvas";
import {
  getResolvedPostBackground,
  getSlidingCanvasBackground,
} from "./post-background";
import type { Post } from "../types";

export type PostCanvasVisuals = {
  photoUrl: string | null;
  hasPhotoBackdrop: boolean;
  sceneTheme: ReturnType<typeof getCanvasSceneTheme>;
  patternTheme: ReturnType<typeof getCanvasPatternTheme>;
  staticCanvasBackground: string | null | undefined;
  slidingCanvasBackground: ReturnType<typeof getSlidingCanvasBackground>;
  hasTransitionBackground: boolean;
};

/**
 * Resolve backdrop layers for the current post + page shift.
 * @param post - post argument
 * @param spec - spec argument
 * @param media - media argument
 * @param backgroundShiftPage - backgroundShiftPage argument
 * @returns Computed value
 */
export function getPostCanvasVisuals(
  post: Post,
  spec: CanvasSpec,
  media: string[],
  backgroundShiftPage: number,
): PostCanvasVisuals {
  const sceneTheme = getCanvasSceneTheme(spec.backgroundScene);
  const patternTheme = getCanvasPatternTheme(spec.backgroundPattern);
  const photoUrl = post.post_type === "slideshow" ? null : getPostPhotoUrl(post);
  const hasPhotoBackdrop =
    hasPostPhotoBackdrop(post) ||
    (post.post_type === "video" && Boolean(media[0]) && !photoUrl);
  const resolvedPostBackground = getResolvedPostBackground(post);
  const staticCanvasBackground = sceneTheme
    ? sceneTheme.base
    : patternTheme
      ? patternTheme.base
      : resolvedPostBackground;
  const slidingCanvasBackground =
    sceneTheme || patternTheme
      ? null
      : getSlidingCanvasBackground(spec, staticCanvasBackground ?? null, backgroundShiftPage);
  return {
    photoUrl,
    hasPhotoBackdrop,
    sceneTheme,
    patternTheme,
    staticCanvasBackground,
    slidingCanvasBackground,
    hasTransitionBackground: !!slidingCanvasBackground,
  };
}
