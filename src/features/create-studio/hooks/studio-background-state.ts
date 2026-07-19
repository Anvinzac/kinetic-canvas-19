/**
 * Public return type for useStudioBackgroundState.
 *
 * Exports: StudioBackgroundState
 * Depends on: features/canvas, create-studio sliding-background + types
 */

import type { Dispatch, SetStateAction } from "react";
import type {
  CanvasSpec,
  GradientTransitionPath,
  getCanvasPatternTheme,
  getCanvasSceneTheme,
} from "@/features/canvas";
import type { getComposerSlidingBackground } from "../lib/sliding-background";
import type { AnimationTemplate, BackgroundMode } from "../types";

export type StudioBackgroundState = {
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
  activePhoto: string | null;
  activeVideo: string | null;
  articlePreview: { url: string; host: string; title: string } | null;
  articleInvalid: boolean;
  safeBg: string;
  selectedTransitionGradients: string[];
  backgroundSpec: Pick<
    CanvasSpec,
    "backgroundStyle" | "gradientPath" | "backgroundScene" | "backgroundPattern"
  >;
  publishBackground: string;
  postType: "link" | "video" | "image" | "text";
  mediaUrls: string[];
  previewBackground: string;
  previewSlidingBackground: ReturnType<typeof getComposerSlidingBackground>;
  previewScene: ReturnType<typeof getCanvasSceneTheme>;
  previewPattern: ReturnType<typeof getCanvasPatternTheme>;
  applyBackdropTemplate: (template: AnimationTemplate) => void;
};
