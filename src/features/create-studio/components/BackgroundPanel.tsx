/**
 * Background source picker panel for create-studio.
 *
 * Exports: BackgroundPanel
 * Depends on: BackgroundModeBody, DoneButton, Panel
 */

import { ImageIcon, Newspaper, Palette, Sparkles, Upload, Video } from "lucide-react";
import type { Dispatch, ReactElement, SetStateAction } from "react";
import type { GradientTransitionPath } from "@/features/canvas";
import type { BackgroundMode, StudioPage } from "../types";
import { BackgroundModeBody } from "./BackgroundModeBody";
import { DoneButton } from "./DoneButton";
import { Panel } from "./Panel";

const SOURCE_TABS: Array<{ id: BackgroundMode; label: string; icon: ReactElement }> = [
  { id: "gradient", label: "gradient", icon: <Palette className="size-3" /> },
  { id: "transition", label: "flow", icon: <Sparkles className="size-3" /> },
  { id: "scene", label: "scene", icon: <Newspaper className="size-3" /> },
  { id: "pattern", label: "pattern", icon: <Sparkles className="size-3" /> },
  { id: "photo", label: "photos", icon: <ImageIcon className="size-3" /> },
  { id: "upload", label: "upload", icon: <Upload className="size-3" /> },
  { id: "video", label: "video", icon: <Video className="size-3" /> },
];

export type BackgroundPanelProps = {
  backgroundMode: BackgroundMode;
  setBackgroundMode: Dispatch<SetStateAction<BackgroundMode>>;
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
  uploadedPhoto: string | null;
  onReplay: () => void;
  onUpload: (file: File | undefined) => void;
  setActivePage: Dispatch<SetStateAction<StudioPage>>;
};

/**
 * Render background mode tabs, mode body, and done control.
 * @param props - Backdrop state and navigation handlers
 * @returns Background editor panel
 */
export function BackgroundPanel(props: BackgroundPanelProps): ReactElement {
  const { backgroundMode, setBackgroundMode, setActivePage } = props;

  return (
    <div className="space-y-4">
      <Panel icon={<ImageIcon />} title="background source">
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-black/25 p-1">
          {SOURCE_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setBackgroundMode(item.id)}
              className={`flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-bold transition ${
                backgroundMode === item.id
                  ? "bg-white text-black"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
        <BackgroundModeBody
          backgroundMode={backgroundMode}
          bg={props.bg}
          setBg={props.setBg}
          selectedGradientPath={props.selectedGradientPath}
          setSelectedGradientPath={props.setSelectedGradientPath}
          selectedSceneId={props.selectedSceneId}
          setSelectedSceneId={props.setSelectedSceneId}
          selectedPatternId={props.selectedPatternId}
          setSelectedPatternId={props.setSelectedPatternId}
          selectedPhoto={props.selectedPhoto}
          setSelectedPhoto={props.setSelectedPhoto}
          selectedVideo={props.selectedVideo}
          setSelectedVideo={props.setSelectedVideo}
          setBackgroundMode={setBackgroundMode}
          uploadedPhoto={props.uploadedPhoto}
          onReplay={props.onReplay}
          onUpload={props.onUpload}
        />
      </Panel>
      <DoneButton onClick={() => setActivePage("write")} />
    </div>
  );
}
