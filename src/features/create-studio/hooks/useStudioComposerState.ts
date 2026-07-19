/**
 * Core create-studio composer state: canvas spec, backdrop, preview, navigation.
 *
 * Exports: useStudioComposerState, StudioComposerState
 * Depends on: useStudioBackgroundState, create-studio lib/templates + summaries
 */

import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { CanvasSpec } from "@/features/canvas";
import { getComposerPages } from "../lib/composer-pages";
import { suggestSize } from "../lib/size";
import {
  getBackgroundSummary,
  getFontSummary,
  getLayoutSummary,
  getMotionSummary,
} from "../lib/studio-summaries";
import { PAGE_TITLES, STATUS_CANVAS } from "../lib/templates";
import type { AnimationTemplate, StudioPage } from "../types";
import type { StudioComposerState } from "./studio-composer-state";
import { useStudioBackgroundState } from "./useStudioBackgroundState";

export type { StudioComposerState } from "./studio-composer-state";

/**
 * Own composer canvas/backdrop state and derived preview/publish values.
 * @returns Studio composer state API for CreateStudioPage wiring
 */
export function useStudioComposerState(): StudioComposerState {
  const navigate = useNavigate();

  const [spec, setSpec] = useState<CanvasSpec>(STATUS_CANVAS);
  const [activePage, setActivePage] = useState<StudioPage>("write");
  const [playKey, setPlayKey] = useState(0);
  const [previewAnimating, setPreviewAnimating] = useState(false);
  const [composerCanvasHeight, setComposerCanvasHeight] = useState<number | null>(null);
  const [posting, setPosting] = useState(false);

  const articleTitleSource = getComposerPages(spec.text)
    .map((page) => page.trim())
    .filter(Boolean)
    .join("\n");
  const bgState = useStudioBackgroundState({ playKey, articleTitleSource });

  const pageTitle = PAGE_TITLES[activePage];
  const backgroundSummary = getBackgroundSummary(
    bgState.backgroundMode,
    bgState.selectedGradientPath.label,
    bgState.selectedSceneId,
    bgState.selectedPatternId,
  );
  const fontSummary = getFontSummary(spec.font, spec.size);
  const colorSummary = spec.color;
  const layoutSummary = getLayoutSummary(spec.y);
  const motionSummary = getMotionSummary(spec);
  const previewPaneHeight = "min(70dvh, 576px)";
  const previewRowHeight = composerCanvasHeight
    ? `${composerCanvasHeight}px`
    : previewPaneHeight;

  function previewSpec(currentTextPage: string): CanvasSpec {
    return { ...spec, text: currentTextPage, ...bgState.backgroundSpec };
  }

  function publishSpec(publishText: string): CanvasSpec {
    return {
      ...spec,
      text: publishText,
      ...bgState.backgroundSpec,
      link: bgState.articlePreview,
    };
  }

  function patch<K extends keyof CanvasSpec>(key: K, value: CanvasSpec[K]): void {
    setSpec((s) => ({ ...s, [key]: value }));
  }

  function updatePlacement(x: number, y: number): void {
    setSpec((s) => ({ ...s, x, y }));
    setPreviewAnimating(false);
  }

  function applyTemplate(template: AnimationTemplate, currentTextPage: string): void {
    bgState.applyBackdropTemplate(template);
    setSpec((s) => ({
      ...s,
      ...template.spec,
      text: s.text,
      backgroundScene: template.backdrop.mode === "scene" ? template.backdrop.sceneId : undefined,
      backgroundPattern:
        template.backdrop.mode === "pattern" ? template.backdrop.patternId : undefined,
      size: suggestSize(currentTextPage, template.spec.size ?? s.size),
    }));
    setPreviewAnimating(true);
    setPlayKey((key) => key + 1);
  }

  function replayPreview(): void {
    setPreviewAnimating(true);
    setPlayKey((key) => key + 1);
  }

  function goBack(): void {
    if (activePage === "write") {
      navigate({ to: "/feed" });
      return;
    }
    setActivePage("write");
  }

  return {
    spec,
    setSpec,
    bg: bgState.bg,
    setBg: bgState.setBg,
    backgroundMode: bgState.backgroundMode,
    setBackgroundMode: bgState.setBackgroundMode,
    selectedGradientPath: bgState.selectedGradientPath,
    setSelectedGradientPath: bgState.setSelectedGradientPath,
    selectedSceneId: bgState.selectedSceneId,
    setSelectedSceneId: bgState.setSelectedSceneId,
    selectedPatternId: bgState.selectedPatternId,
    setSelectedPatternId: bgState.setSelectedPatternId,
    selectedPhoto: bgState.selectedPhoto,
    setSelectedPhoto: bgState.setSelectedPhoto,
    selectedVideo: bgState.selectedVideo,
    setSelectedVideo: bgState.setSelectedVideo,
    uploadedPhoto: bgState.uploadedPhoto,
    setUploadedPhoto: bgState.setUploadedPhoto,
    articleUrl: bgState.articleUrl,
    setArticleUrl: bgState.setArticleUrl,
    articleOpen: bgState.articleOpen,
    setArticleOpen: bgState.setArticleOpen,
    activePage,
    setActivePage,
    playKey,
    previewAnimating,
    setPreviewAnimating,
    composerCanvasHeight,
    setComposerCanvasHeight,
    posting,
    setPosting,
    activePhoto: bgState.activePhoto,
    activeVideo: bgState.activeVideo,
    articlePreview: bgState.articlePreview,
    articleInvalid: bgState.articleInvalid,
    safeBg: bgState.safeBg,
    selectedTransitionGradients: bgState.selectedTransitionGradients,
    previewSpec,
    publishSpec,
    publishBackground: bgState.publishBackground,
    postType: bgState.postType,
    mediaUrls: bgState.mediaUrls,
    pageTitle,
    backgroundSummary,
    fontSummary,
    colorSummary,
    layoutSummary,
    motionSummary,
    previewPaneHeight,
    previewRowHeight,
    previewBackground: bgState.previewBackground,
    previewSlidingBackground: bgState.previewSlidingBackground,
    previewScene: bgState.previewScene,
    previewPattern: bgState.previewPattern,
    patch,
    updatePlacement,
    applyTemplate,
    replayPreview,
    goBack,
  };
}
