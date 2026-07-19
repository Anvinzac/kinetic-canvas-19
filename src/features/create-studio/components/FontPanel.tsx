/**
 * Font family and type-scale controls for create-studio.
 *
 * Exports: FontPanel
 * Depends on: canvas FONTS, SliderRow, DoneButton
 */

import { SlidersHorizontal, Type } from "lucide-react";
import type { Dispatch, ReactElement, SetStateAction } from "react";
import { FONTS, type CanvasSpec } from "@/features/canvas";
import type { StudioPage } from "../types";
import { DoneButton } from "./DoneButton";
import { Panel } from "./Panel";
import { SliderRow } from "./SliderRow";

export type FontPanelProps = {
  spec: CanvasSpec;
  patch: <K extends keyof CanvasSpec>(key: K, value: CanvasSpec[K]) => void;
  onReplay: () => void;
  setActivePage: Dispatch<SetStateAction<StudioPage>>;
};

/**
 * Render font family chips and size/weight sliders.
 * @param props - Spec patcher, replay, and done navigation
 * @returns Font editor panel
 */
export function FontPanel({
  spec,
  patch,
  onReplay,
  setActivePage,
}: FontPanelProps): ReactElement {
  return (
    <div className="space-y-4">
      <Panel icon={<Type />} title="font family">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {FONTS.map((font) => (
            <button
              key={font}
              type="button"
              onClick={() => {
                patch("font", font);
                onReplay();
              }}
              className={`shrink-0 rounded-full px-3 py-2 text-xs font-bold ${
                spec.font === font ? "bg-white text-black" : "bg-white/10 text-white"
              }`}
              style={{ fontFamily: font }}
            >
              {font}
            </button>
          ))}
        </div>
      </Panel>

      <Panel icon={<SlidersHorizontal />} title="type scale">
        <div className="space-y-4">
          <SliderRow
            label="scale"
            value={spec.size}
            min={36}
            max={132}
            onChange={(value) => patch("size", value)}
          />
          <SliderRow
            label="weight"
            value={spec.weight}
            min={300}
            max={900}
            step={100}
            onChange={(value) => patch("weight", value)}
          />
        </div>
      </Panel>
      <DoneButton onClick={() => setActivePage("write")} />
    </div>
  );
}
