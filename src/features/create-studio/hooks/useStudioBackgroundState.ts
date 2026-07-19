/**
 * Create-studio backdrop state: mode, media, scene/pattern, article, preview/publish bg.
 *
 * Exports: useStudioBackgroundState, StudioBackgroundState
 * Depends on: features/canvas, create-studio article/templates/sliding-background
 */

import { useState } from "react";
import {
  GRADIENTS,
  isUsableCanvasBackground,
  resolveCanvasBackground,
  type CanvasSpec,
  type GradientTransitionPath,
  getCanvasPatternTheme,
  getCanvasSceneTheme,
} from "@/features/canvas";
import { getArticleTitle, getUrlHost, normalizeArticleUrl } from "../lib/article";
import { getComposerSlidingBackground } from "../lib/sliding-background";
import {
  DEFAULT_TRANSITION_PATH,
  PRELOADED_PHOTOS,
  PRELOADED_VIDEOS,
} from "../lib/templates";
import type { AnimationTemplate, BackgroundMode } from "../types";
import type { StudioBackgroundState } from "./studio-background-state";

export type { StudioBackgroundState } from "./studio-background-state";

type UseStudioBackgroundStateArgs = {
  playKey: number;
  articleTitleSource: string;
};

/**
 * Own backdrop/article state and derived preview/publish background values.
 * @param args - playKey for transition preview + text used for article title
 * @returns Background state API for the composer orchestrator
 */
export function useStudioBackgroundState(
  args: UseStudioBackgroundStateArgs,
): StudioBackgroundState {
  const { playKey, articleTitleSource } = args;

  const [bg, setBg] = useState<string>(GRADIENTS[0]);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>("gradient");
  const [selectedGradientPath, setSelectedGradientPath] =
    useState<GradientTransitionPath>(DEFAULT_TRANSITION_PATH);
  const [selectedSceneId, setSelectedSceneId] = useState("paper-cut-sunrise");
  const [selectedPatternId, setSelectedPatternId] = useState("waves");
  const [selectedPhoto, setSelectedPhoto] = useState(PRELOADED_PHOTOS[0].url);
  const [selectedVideo, setSelectedVideo] = useState(PRELOADED_VIDEOS[0].url);
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [articleUrl, setArticleUrl] = useState("");
  const [articleOpen, setArticleOpen] = useState(false);

  const activePhoto =
    backgroundMode === "upload" ? uploadedPhoto : backgroundMode === "photo" ? selectedPhoto : null;
  const activeVideo = backgroundMode === "video" ? selectedVideo : null;
  const normalizedArticleUrl = articleOpen ? normalizeArticleUrl(articleUrl) : "";
  const articlePreview = normalizedArticleUrl
    ? {
        url: normalizedArticleUrl,
        host: getUrlHost(normalizedArticleUrl),
        title: getArticleTitle(articleTitleSource),
      }
    : null;
  const articleInvalid = articleOpen && articleUrl.trim().length > 0 && !articlePreview;
  const safeBg = resolveCanvasBackground(bg, "composer");
  const selectedTransitionGradients =
    selectedGradientPath.gradients.filter(isUsableCanvasBackground).length > 0
      ? selectedGradientPath.gradients.filter(isUsableCanvasBackground)
      : [safeBg];
  const backgroundSpec =
    backgroundMode === "transition"
      ? ({
          backgroundStyle: "transition",
          gradientPath: [...selectedTransitionGradients],
          backgroundScene: undefined,
          backgroundPattern: undefined,
        } satisfies Pick<
          CanvasSpec,
          "backgroundStyle" | "gradientPath" | "backgroundScene" | "backgroundPattern"
        >)
      : ({
          backgroundStyle: "static",
          gradientPath: [],
          backgroundScene: backgroundMode === "scene" ? selectedSceneId : undefined,
          backgroundPattern: backgroundMode === "pattern" ? selectedPatternId : undefined,
        } satisfies Pick<
          CanvasSpec,
          "backgroundStyle" | "gradientPath" | "backgroundScene" | "backgroundPattern"
        >);

  const publishBackground =
    backgroundMode === "transition"
      ? resolveCanvasBackground(selectedTransitionGradients[0], "publish")
      : backgroundMode === "scene"
        ? (getCanvasSceneTheme(selectedSceneId)?.base ?? safeBg)
        : backgroundMode === "pattern"
          ? (getCanvasPatternTheme(selectedPatternId)?.base ?? safeBg)
          : safeBg;
  const postType = articlePreview ? "link" : activeVideo ? "video" : activePhoto ? "image" : "text";
  const mediaUrls = articlePreview
    ? [articlePreview.url]
    : activeVideo
      ? [activeVideo]
      : activePhoto
        ? [activePhoto]
        : [];
  const previewBackground =
    backgroundMode === "transition"
      ? resolveCanvasBackground(
          selectedTransitionGradients[playKey % selectedTransitionGradients.length],
          "preview",
        )
      : safeBg;
  const previewSlidingBackground =
    backgroundMode === "transition"
      ? getComposerSlidingBackground(selectedTransitionGradients, playKey)
      : null;
  const previewScene = backgroundMode === "scene" ? getCanvasSceneTheme(selectedSceneId) : null;
  const previewPattern =
    backgroundMode === "pattern" ? getCanvasPatternTheme(selectedPatternId) : null;

  function applyBackdropTemplate(template: AnimationTemplate): void {
    setBackgroundMode(template.backdrop.mode);
    if (template.backdrop.mode === "gradient") {
      setBg(template.backdrop.gradient);
    }
    if (template.backdrop.mode === "transition") {
      setSelectedGradientPath(template.backdrop.path);
      setBg(template.backdrop.path.gradients[0] ?? GRADIENTS[0]);
    }
    if (template.backdrop.mode === "scene") {
      setSelectedSceneId(template.backdrop.sceneId);
      setBg(getCanvasSceneTheme(template.backdrop.sceneId)?.base ?? GRADIENTS[0]);
    }
    if (template.backdrop.mode === "pattern") {
      setSelectedPatternId(template.backdrop.patternId);
      setBg(getCanvasPatternTheme(template.backdrop.patternId)?.base ?? GRADIENTS[0]);
    }
    if (template.backdrop.mode === "photo") {
      setSelectedPhoto(template.backdrop.url);
    }
    if (template.backdrop.mode === "video") {
      setSelectedVideo(template.backdrop.url);
    }
  }

  return {
    bg,
    setBg,
    backgroundMode,
    setBackgroundMode,
    selectedGradientPath,
    setSelectedGradientPath,
    selectedSceneId,
    setSelectedSceneId,
    selectedPatternId,
    setSelectedPatternId,
    selectedPhoto,
    setSelectedPhoto,
    selectedVideo,
    setSelectedVideo,
    uploadedPhoto,
    setUploadedPhoto,
    articleUrl,
    setArticleUrl,
    articleOpen,
    setArticleOpen,
    activePhoto,
    activeVideo,
    articlePreview,
    articleInvalid,
    safeBg,
    selectedTransitionGradients,
    backgroundSpec,
    publishBackground,
    postType,
    mediaUrls,
    previewBackground,
    previewSlidingBackground,
    previewScene,
    previewPattern,
    applyBackdropTemplate,
  };
}
