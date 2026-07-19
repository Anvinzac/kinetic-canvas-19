/**
 * Public return type for useStudioComposerState.
 *
 * Exports: StudioComposerState
 * Depends on: features/canvas, useStudioBackgroundState, create-studio types
 */

import type { Dispatch, SetStateAction } from "react";
import type { CanvasSpec } from "@/features/canvas";
import type { AnimationTemplate, StudioPage } from "../types";
import type { StudioBackgroundState } from "./studio-background-state";

export type StudioComposerState = {
  spec: CanvasSpec;
  setSpec: Dispatch<SetStateAction<CanvasSpec>>;
  bg: string;
  setBg: Dispatch<SetStateAction<string>>;
  backgroundMode: StudioBackgroundState["backgroundMode"];
  setBackgroundMode: StudioBackgroundState["setBackgroundMode"];
  selectedGradientPath: StudioBackgroundState["selectedGradientPath"];
  setSelectedGradientPath: StudioBackgroundState["setSelectedGradientPath"];
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
  articlePreview: StudioBackgroundState["articlePreview"];
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
  previewSlidingBackground: StudioBackgroundState["previewSlidingBackground"];
  previewScene: StudioBackgroundState["previewScene"];
  previewPattern: StudioBackgroundState["previewPattern"];
  patch: <K extends keyof CanvasSpec>(key: K, value: CanvasSpec[K]) => void;
  updatePlacement: (x: number, y: number) => void;
  applyTemplate: (template: AnimationTemplate, currentTextPage: string) => void;
  replayPreview: () => void;
  goBack: () => void;
};
