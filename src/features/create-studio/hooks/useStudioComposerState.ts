/**
 * Core create-studio composer state: canvas spec, backdrop, preview, navigation.
 *
 * Exports: useStudioComposerState
 * Depends on: features/canvas, create-studio lib/templates + types
 */

import { useNavigate } from "@tanstack/react-router";
import { useState, type Dispatch, type SetStateAction } from "react";
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
import { getComposerPages } from "../lib/composer-pages";
import { suggestSize } from "../lib/size";
import { getComposerSlidingBackground } from "../lib/sliding-background";
import {
  DEFAULT_TRANSITION_PATH,
  PAGE_TITLES,
  PLACEMENTS,
  PRELOADED_PHOTOS,
  PRELOADED_VIDEOS,
  STATUS_CANVAS,
} from "../lib/templates";
import type { AnimationTemplate, BackgroundMode, StudioPage } from "../types";

export type StudioComposerState = {
  spec: CanvasSpec;
  setSpec: Dispatch<SetStateAction<CanvasSpec>>;
  bg: string;
  setBg: Dispatch<SetStateAction<string>>;
  backgroundMode: BackgroundMode;
  setBackgroundMode: Dispatch<SetStateAction<BackgroundMode>>;
  selectedGradientPath: GradientTransitionPath;
  setSelectedGradientPath: Dispatch<SetStateAction<GradientTransitionPath>>;
  selectedSceneId: string;
  setSelectedSceneId: Dispatch<SetStateAction<string>>;
  selectedPatternId: string;
  setSelectedPatternId: Dispatch<SetStateAction<string>>;
  selectedPhoto: string;
  setSelectedPhoto: Dispatch<SetStateAction<string>>;
  selectedVideo: string;
  setSelectedVideo: Dispatch<SetStateAction<string>>;
  uploadedPhoto: string | null;
  setUploadedPhoto: Dispatch<SetStateAction<string | null>>;
  articleUrl: string;
  setArticleUrl: Dispatch<SetStateAction<string>>;
  articleOpen: boolean;
  setArticleOpen: Dispatch<SetStateAction<boolean>>;
  activePage: StudioPage;
  setActivePage: Dispatch<SetStateAction<StudioPage>>;
  playKey: number;
  previewAnimating: boolean;
  setPreviewAnimating: Dispatch<SetStateAction<boolean>>;
  composerCanvasHeight: number | null;
  setComposerCanvasHeight: Dispatch<SetStateAction<number | null>>;
  posting: boolean;
  setPosting: Dispatch<SetStateAction<boolean>>;
  activePhoto: string | null;
  activeVideo: string | null;
  articlePreview: { url: string; host: string; title: string } | null;
  articleInvalid: boolean;
  safeBg: string;
  selectedTransitionGradients: string[];
  previewSpec: (currentTextPage: string) => CanvasSpec;
  publishSpec: (publishText: string) => CanvasSpec;
  publishBackground: string;
  postType: "link" | "video" | "image" | "text";
  mediaUrls: string[];
  pageTitle: { title: string; subtitle: string };
  backgroundSummary: string;
  fontSummary: string;
  colorSummary: string;
  layoutSummary: string;
  motionSummary: string;
  previewPaneHeight: string;
  previewRowHeight: string;
  previewBackground: string;
  previewSlidingBackground: ReturnType<typeof getComposerSlidingBackground>;
  previewScene: ReturnType<typeof getCanvasSceneTheme>;
  previewPattern: ReturnType<typeof getCanvasPatternTheme>;
  patch: <K extends keyof CanvasSpec>(key: K, value: CanvasSpec[K]) => void;
  updatePlacement: (x: number, y: number) => void;
  applyTemplate: (template: AnimationTemplate, currentTextPage: string) => void;
  replayPreview: () => void;
  goBack: () => void;
};

/**
 * Own composer canvas/backdrop state and derived preview/publish values.
 * @returns Studio composer state API for CreateStudioPage wiring
 */
export function useStudioComposerState(): StudioComposerState {
  const navigate = useNavigate();

  const [spec, setSpec] = useState<CanvasSpec>(STATUS_CANVAS);
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
  const [activePage, setActivePage] = useState<StudioPage>("write");
  const [playKey, setPlayKey] = useState(0);
  const [previewAnimating, setPreviewAnimating] = useState(false);
  const [composerCanvasHeight, setComposerCanvasHeight] = useState<number | null>(null);
  const [posting, setPosting] = useState(false);

  const activePhoto =
    backgroundMode === "upload" ? uploadedPhoto : backgroundMode === "photo" ? selectedPhoto : null;
  const activeVideo = backgroundMode === "video" ? selectedVideo : null;
  const normalizedArticleUrl = articleOpen ? normalizeArticleUrl(articleUrl): "";
  const publishTextPlaceholder = getComposerPages(spec.text)
    .map((page) => page.trim())
    .filter(Boolean)
    .join("\n");
  const articlePreview = normalizedArticleUrl
    ? {
        url: normalizedArticleUrl,
        host: getUrlHost(normalizedArticleUrl),
        title: getArticleTitle(publishTextPlaceholder),
      }
    : null;
  const articleInvalid = articleOpen && articleUrl.trim().length > 0 && !articlePreview;
  const safeBg = resolveCanvasBackground(bg, "composer");
  const selectedTransitionGradients =
    selectedGradientPath.gradients.filter(isUsableCanvasBackground).length > 0
      ? selectedGradientPath.gradients.filter(isUsableCanvasBackground): [safeBg];
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
        >): ({
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
      ? resolveCanvasBackground(selectedTransitionGradients[0], "publish"): backgroundMode === "scene"
        ? (getCanvasSceneTheme(selectedSceneId)?.base ?? safeBg): backgroundMode === "pattern"
          ? (getCanvasPatternTheme(selectedPatternId)?.base ?? safeBg): safeBg;
  const postType = articlePreview ? "link" : activeVideo ? "video" : activePhoto ? "image" : "text";
  const mediaUrls = articlePreview
    ? [articlePreview.url]
    : activeVideo
      ? [activeVideo]
      : activePhoto
        ? [activePhoto]
        : [];
  const pageTitle = PAGE_TITLES[activePage];
  const backgroundSummary =
    backgroundMode === "gradient"
      ? "gradient"
      : backgroundMode === "transition"
        ? selectedGradientPath.label
        : backgroundMode === "scene"
          ? (getCanvasSceneTheme(selectedSceneId)?.label ?? "scene"): backgroundMode === "pattern"
            ? (getCanvasPatternTheme(selectedPatternId)?.label ?? "pattern"): backgroundMode === "photo"
              ? "preloaded photo"
              : backgroundMode === "video"
                ? "video"
                : "library photo";
  const fontSummary = `${spec.font} · ${spec.size}px`;
  const colorSummary = spec.color;
  const layoutSummary = PLACEMENTS.find((placement) => placement.y === spec.y)?.label ?? "custom";
  const motionSummary = `${spec.entrance} · ${spec.tempo} · ${spec.rhythm}`;
  const previewPaneHeight = "min(70dvh, 576px)";
  const previewRowHeight = composerCanvasHeight
    ? `${composerCanvasHeight}px`
    : previewPaneHeight;
  const previewBackground =
    backgroundMode === "transition"
      ? resolveCanvasBackground(
          selectedTransitionGradients[playKey % selectedTransitionGradients.length],
          "preview",
        ): safeBg;
  const previewSlidingBackground =
    backgroundMode === "transition"
      ? getComposerSlidingBackground(selectedTransitionGradients, playKey): null;
  const previewScene = backgroundMode === "scene" ? getCanvasSceneTheme(selectedSceneId): null;
  const previewPattern =
    backgroundMode === "pattern" ? getCanvasPatternTheme(selectedPatternId): null;

  function previewSpec(currentTextPage: string): CanvasSpec {
    return { ...spec, text: currentTextPage, ...backgroundSpec };
  }

  function publishSpec(publishText: string): CanvasSpec {
    return {
      ...spec,
      text: publishText,
      ...backgroundSpec,
      link: articlePreview,
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
    activePage,
    setActivePage,
    playKey,
    previewAnimating,
    setPreviewAnimating,
    composerCanvasHeight,
    setComposerCanvasHeight,
    posting,
    setPosting,
    activePhoto,
    activeVideo,
    articlePreview,
    articleInvalid,
    safeBg,
    selectedTransitionGradients,
    previewSpec,
    publishSpec,
    publishBackground,
    postType,
    mediaUrls,
    pageTitle,
    backgroundSummary,
    fontSummary,
    colorSummary,
    layoutSummary,
    motionSummary,
    previewPaneHeight,
    previewRowHeight,
    previewBackground,
    previewSlidingBackground,
    previewScene,
    previewPattern,
    patch,
    updatePlacement,
    applyTemplate,
    replayPreview,
    goBack,
  };
}
