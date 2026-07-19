/**
 * Derived post-player view model: backgrounds, comment geometry, meta, display spec.
 *
 * Exports: usePostPlaybackDerived
 * Depends on: post-canvas-visuals, post-comment-layout, post-meta, playback-timing
 */

import { useMemo } from "react";
import type { CanvasSpec } from "@/lib/canvas";
import { shouldFloatComment } from "../lib/comment-text";
import { getUniformPageTextSize } from "../lib/playback-timing";
import { getCommentFlightGeometry } from "../lib/post-comment-layout";
import { getPostCanvasVisuals } from "../lib/post-canvas-visuals";
import {
  getArticlePreview,
  getPostHashtags,
  getPostViewCount,
} from "../lib/post-meta";
import type { FlowComment, Post, Profile } from "../types";

export type UsePostPlaybackDerivedArgs = {
  post: Post;
  spec: CanvasSpec;
  textPages: string[];
  media: string[];
  textPage: number;
  backgroundShiftPage: number;
  canvasWidth: number;
  likes: number;
  chronologicalCommentsLength: number;
  isExporting: boolean;
  isPaused: boolean;
  activeComment: FlowComment | null;
  activeCommentLabel: string;
  profilesById: Map<string, Profile>;
  displaySize: number;
};

/**
 * @responsibility Compute pure derived fields for PostCard from playback state.
 */
export function usePostPlaybackDerived(args: UsePostPlaybackDerivedArgs) {
  const {
    post,
    spec,
    textPages,
    media,
    textPage,
    backgroundShiftPage,
    canvasWidth,
    likes,
    chronologicalCommentsLength,
    isExporting,
    isPaused,
    activeComment,
    activeCommentLabel,
    profilesById,
    displaySize,
  } = args;

  const currentText = textPages[textPage] ?? textPages[0] ?? "";
  const visuals = useMemo(
    () => getPostCanvasVisuals(post, spec, media, backgroundShiftPage),
    [post, spec, media, backgroundShiftPage],
  );
  const commentLayout = useMemo(
    () => getCommentFlightGeometry(canvasWidth),
    [canvasWidth],
  );
  const postHashtags = useMemo(
    () => getPostHashtags(spec.text, post.post_type, textPages),
    [post.post_type, spec.text, textPages],
  );
  const viewCount = useMemo(
    () => getPostViewCount(post, likes, chronologicalCommentsLength),
    [chronologicalCommentsLength, likes, post],
  );
  const uniformPageSize = useMemo(
    () => getUniformPageTextSize(spec.size, textPages, spec.text),
    [spec.size, textPages, spec.text],
  );

  return {
    currentText,
    visuals,
    commentLayout,
    showingFlyingComment:
      !isExporting &&
      !isPaused &&
      !!activeComment &&
      shouldFloatComment(activeCommentLabel),
    activeCommentAuthor: activeComment
      ? profilesById.get(activeComment.user_id)
      : undefined,
    postHashtags,
    viewCount,
    uniformPageSize,
    displaySpec: {
      ...spec,
      text: currentText,
      size: displaySize,
      entrance: "fade" as const,
    },
    articlePreview: getArticlePreview(spec, media),
  };
}

export type UsePostPlaybackDerivedResult = ReturnType<typeof usePostPlaybackDerived>;
