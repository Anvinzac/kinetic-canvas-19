/**
 * Gradient, flow, scene, and pattern pickers for create-studio backgrounds.
 *
 * Exports: BackgroundDecorativeBody
 * Depends on: canvas themes, GradientPathButton
 */

import type { Dispatch, ReactElement, SetStateAction } from "react";
import {
  CANVAS_PATTERN_THEMES,
  CANVAS_SCENE_THEMES,
  GRADIENTS,
  TRANSITION_GRADIENT_PATHS,
  getSceneBackgroundStyle,
  type GradientTransitionPath,
} from "@/features/canvas";
import type { BackgroundMode } from "../types";
import { GradientPathButton } from "./GradientPathButton";

export type BackgroundDecorativeBodyProps = {
  backgroundMode: Extract<BackgroundMode, "gradient" | "transition" | "scene" | "pattern">;
  bg: string;
  setBg: Dispatch<SetStateAction<string>>;
  selectedGradientPath: GradientTransitionPath;
  setSelectedGradientPath: Dispatch<SetStateAction<GradientTransitionPath>>;
  selectedSceneId: string;
  setSelectedSceneId: Dispatch<SetStateAction<string>>;
  selectedPatternId: string;
  setSelectedPatternId: Dispatch<SetStateAction<string>>;
  onReplay: () => void;
};

/**
 * Render decorative (non-media) background mode pickers.
 * @param props - Active decorative mode and selection state
 * @returns Decorative mode body
 */
export function BackgroundDecorativeBody({
  backgroundMode,
  bg,
  setBg,
  selectedGradientPath,
  setSelectedGradientPath,
  selectedSceneId,
  setSelectedSceneId,
  selectedPatternId,
  setSelectedPatternId,
  onReplay,
}: BackgroundDecorativeBodyProps): ReactElement {
  if (backgroundMode === "gradient") {
    return (
      <div className="mt-3 grid grid-cols-5 gap-2">
        {GRADIENTS.map((gradient) => (
          <button
            key={gradient}
            type="button"
            onClick={() => setBg(gradient)}
            className={`relative aspect-square rounded-2xl bg-white/5 p-[2px] transition ring-2 ${
              bg === gradient ? "ring-white" : "ring-transparent"
            }`}
            aria-label="Choose gradient background"
          >
            <span
              className="block size-full overflow-hidden rounded-[14px]"
              style={{ background: gradient }}
              aria-hidden
            />
          </button>
        ))}
      </div>
    );
  }

  if (backgroundMode === "transition") {
    return (
      <div className="mt-3 space-y-2">
        {TRANSITION_GRADIENT_PATHS.map((path) => (
          <GradientPathButton
            key={path.id}
            path={path}
            active={selectedGradientPath.id === path.id}
            onClick={() => {
              setSelectedGradientPath(path);
              setBg(path.gradients[0] ?? GRADIENTS[0]);
              onReplay();
            }}
          />
        ))}
      </div>
    );
  }

  if (backgroundMode === "scene") {
    return (
      <div className="mt-3 grid grid-cols-1 gap-2">
        {CANVAS_SCENE_THEMES.map((theme) => (
          <button
            key={theme.id}
            type="button"
            onClick={() => {
              setSelectedSceneId(theme.id);
              setBg(theme.base);
              onReplay();
            }}
            className={`relative min-h-28 overflow-hidden rounded-2xl p-3 text-left ring-2 transition ${
              selectedSceneId === theme.id ? "ring-white" : "ring-transparent"
            }`}
            style={getSceneBackgroundStyle(theme, 0)}
          >
            <span className="absolute inset-0 bg-gradient-to-b from-black/5 to-black/45" />
            <span className="relative block text-sm font-black text-white">{theme.label}</span>
            <span className="relative mt-1 block font-mono text-[9px] uppercase tracking-[0.14em] text-white/70">
              {theme.mood}
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      {CANVAS_PATTERN_THEMES.map((theme) => (
        <button
          key={theme.id}
          type="button"
          onClick={() => {
            setSelectedPatternId(theme.id);
            setBg(theme.base);
            onReplay();
          }}
          className={`relative min-h-24 overflow-hidden rounded-2xl p-2 text-left ring-2 transition ${
            selectedPatternId === theme.id ? "ring-white" : "ring-transparent"
          }`}
          style={{
            backgroundColor: theme.base,
            backgroundImage: theme.image,
            backgroundSize: theme.size,
            backgroundRepeat: "repeat",
          }}
        >
          <span className="absolute inset-0 bg-gradient-to-b from-black/5 to-black/45" />
          <span className="relative block text-xs font-black text-white">{theme.label}</span>
          <span className="relative mt-1 block font-mono text-[8px] uppercase tracking-[0.12em] text-white/65">
            {theme.mood}
          </span>
        </button>
      ))}
    </div>
  );
}
