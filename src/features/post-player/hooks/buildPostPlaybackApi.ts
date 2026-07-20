/**
 * Assembles the public usePostPlayback return object for PostCard.
 *
 * Exports: buildPostPlaybackApi
 * Depends on: sibling hook result types
 */

import type { Dispatch, RefObject, SetStateAction } from "react";
import type { CanvasSpec } from "@/features/canvas";
import type { Comment, Post, Profile } from "../types";
import type { UseCommentFlowResult } from "./useCommentFlow";
import type { UseCommentStoryResult } from "./useCommentStory";
import type { UsePostEntranceResult } from "./usePostEntrance";
import type { UsePostPlaybackDerivedResult } from "./usePostPlaybackDerived";
import type { UsePostRingProgressResult } from "./usePostRingProgress";
import type { UseTextFitScaleResult } from "./useTextFitScale";

export type BuildPostPlaybackApiArgs = {
  post: Post;
  author?: Profile;
  likes: number;
  liked: boolean;
  comments: Comment[];
  profilesById: Map<string, Profile>;
  spec: CanvasSpec;
  textPages: string[];
  slide: number;
  textPage: number;
  playKey: number;
  backgroundShiftPage: number;
  actionMenuOpen: boolean;
  setActionMenuOpen: Dispatch<SetStateAction<boolean>>;
  isPaused: boolean;
  isVisible: boolean;
  pageRevealed: boolean;
  isExporting: boolean;
  canvasWidth: number;
  canvasRef: RefObject<HTMLElement | null>;
  setCanvasEl: Dispatch<SetStateAction<HTMLElement | null>>;
  videoRef: RefObject<HTMLVideoElement | null>;
  postUrl: string;
  media: string[];
  ring: UsePostRingProgressResult;
  entrance: UsePostEntranceResult;
  derived: UsePostPlaybackDerivedResult;
  textFit: UseTextFitScaleResult;
  commentFlow: UseCommentFlowResult;
  commentStory: UseCommentStoryResult;
  handleExportVideo: () => Promise<void>;
  selectTextPage: (page: number) => void;
  setIsPaused: Dispatch<SetStateAction<boolean>>;
  setPageRevealed: Dispatch<SetStateAction<boolean>>;
};

/**
 * Package orchestrator state into the PostCard playback API.
 * @param a - Orchestrator state, derived visuals, and nested hook results
 * @returns Flat playback API consumed by PostCard
 */
export function buildPostPlaybackApi(
  a: BuildPostPlaybackApiArgs,
): ReturnType<typeof assemblePostPlaybackApi> {
  return assemblePostPlaybackApi(a);
}

function assemblePostPlaybackApi(a: BuildPostPlaybackApiArgs) {
  const { ring, entrance, derived, commentFlow, commentStory } = a;
  return {
    post: a.post,
    author: a.author,
    likes: a.likes,
    liked: a.liked,
    comments: a.comments,
    profilesById: a.profilesById,
    spec: a.spec,
    textPages: a.textPages,
    slide: a.slide,
    textPage: a.textPage,
    playKey: a.playKey,
    backgroundShiftPage: a.backgroundShiftPage,
    actionMenuOpen: a.actionMenuOpen,
    setActionMenuOpen: a.setActionMenuOpen,
    isPaused: a.isPaused,
    isVisible: a.isVisible,
    pageRevealed: a.pageRevealed,
    isExporting: a.isExporting,
    canvasWidth: a.canvasWidth,
    canvasRef: a.canvasRef,
    setCanvasEl: a.setCanvasEl,
    videoRef: a.videoRef,
    postUrl: a.postUrl,
    showCollectionPicker: ring.showCollectionPicker,
    selectedFolders: ring.selectedFolders,
    selectedTags: ring.selectedTags,
    media: a.media,
    articlePreview: derived.articlePreview,
    commentMaxWidth: derived.commentLayout.commentMaxWidth,
    commentStartX: derived.commentLayout.commentStartX,
    commentEndX: derived.commentLayout.commentEndX,
    commentOverlapEnterX: derived.commentLayout.commentOverlapEnterX,
    commentOverlapExitX: derived.commentLayout.commentOverlapExitX,
    currentText: derived.currentText,
    sceneTheme: derived.visuals.sceneTheme,
    patternTheme: derived.visuals.patternTheme,
    photoUrl: derived.visuals.photoUrl,
    hasPhotoBackdrop: derived.visuals.hasPhotoBackdrop,
    staticCanvasBackground: derived.visuals.staticCanvasBackground,
    slidingCanvasBackground: derived.visuals.slidingCanvasBackground,
    hasTransitionBackground: derived.visuals.hasTransitionBackground,
    displaySpec: derived.displaySpec,
    postHashtags: derived.postHashtags,
    viewCount: derived.viewCount,
    uniformPageSize: derived.uniformPageSize,
    showingFlyingComment: derived.showingFlyingComment,
    activeCommentAuthor: derived.activeCommentAuthor,
    textFit: a.textFit,
    commentFlow,
    commentStory,
    handleExportVideo: a.handleExportVideo,
    handleLikePointerDown: ring.handleLikePointerDown,
    handleLikePointerUp: ring.handleLikePointerUp,
    handleLikePointerCancel: ring.handleLikePointerCancel,
    handleToggleFolder: ring.handleToggleFolder,
    handleToggleTag: ring.handleToggleTag,
    handleCollectionSave: ring.handleCollectionSave,
    handleCollectionClose: ring.handleCollectionClose,
    handleCanvasTap: entrance.handleCanvasTap,
    resetCurrentPage: entrance.resetCurrentPage,
    replayFromBeginning: entrance.replayFromBeginning,
    selectTextPage: a.selectTextPage,
    toggleChips: () => {
      commentFlow.setShowChips((open) => {
        const next = !open;
        if (next) {
          commentStory.setStoryIndex(0);
          commentStory.setStoryPage(0);
          commentStory.setStoryFastMode(false);
          commentStory.setStoryPlayKey((k) => k + 1);
        } else {
          commentFlow.setShowQuickCommentChips(false);
        }
        return next;
      });
    },
    openCommentStories: () => {
      commentStory.openCommentStories();
      commentFlow.setShowChips(false);
      commentFlow.setShowQuickCommentChips(false);
      a.setIsPaused(true);
    },
    closeCommentStories: () =>
      commentStory.closeCommentStories(a.setIsPaused, a.setPageRevealed),
  };
}

export type BuildPostPlaybackApiResult = ReturnType<typeof assemblePostPlaybackApi>;
