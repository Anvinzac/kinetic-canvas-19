/**
 * Mode-specific backdrop pickers for the create-studio background panel.
 *
 * Exports: BackgroundModeBody
 * Depends on: BackgroundDecorativeBody, BackgroundMediaBody
 */

import type { Dispatch, ReactElement, SetStateAction } from "react";
import type { GradientTransitionPath } from "@/features/canvas";
import type { BackgroundMode } from "../types";
import { BackgroundDecorativeBody } from "./BackgroundDecorativeBody";
import { BackgroundMediaBody } from "./BackgroundMediaBody";

export type BackgroundModeBodyProps = {
  backgroundMode: BackgroundMode;
  bg: string;
  setBg: Dispatch<SetStateAction<string>>;
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
  setBackgroundMode: Dispatch<SetStateAction<BackgroundMode>>;
  uploadedPhoto: string | null;
  onReplay: () => void;
  onUpload: (file: File | undefined) => void;
};

/**
 * Route to decorative or media background pickers by mode.
 * @param props - Backdrop selection state and upload/replay handlers
 * @returns Mode body content (or null when mode has no body)
 */
export function BackgroundModeBody(props: BackgroundModeBodyProps): ReactElement | null {
  const { backgroundMode } = props;

  if (
    backgroundMode === "gradient" ||
    backgroundMode === "transition" ||
    backgroundMode === "scene" ||
    backgroundMode === "pattern"
  ) {
    return (
      <BackgroundDecorativeBody
        backgroundMode={backgroundMode}
        bg={props.bg}
        setBg={props.setBg}
        selectedGradientPath={props.selectedGradientPath}
        setSelectedGradientPath={props.setSelectedGradientPath}
        selectedSceneId={props.selectedSceneId}
        setSelectedSceneId={props.setSelectedSceneId}
        selectedPatternId={props.selectedPatternId}
        setSelectedPatternId={props.setSelectedPatternId}
        onReplay={props.onReplay}
      />
    );
  }

  if (
    backgroundMode === "photo" ||
    backgroundMode === "upload" ||
    backgroundMode === "video"
  ) {
    return (
      <BackgroundMediaBody
        backgroundMode={backgroundMode}
        selectedPhoto={props.selectedPhoto}
        setSelectedPhoto={props.setSelectedPhoto}
        selectedVideo={props.selectedVideo}
        setSelectedVideo={props.setSelectedVideo}
        setBackgroundMode={props.setBackgroundMode}
        uploadedPhoto={props.uploadedPhoto}
        onUpload={props.onUpload}
      />
    );
  }

  return null;
}
