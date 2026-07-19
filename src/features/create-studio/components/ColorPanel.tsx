/**
 * Text color palette picker for create-studio.
 *
 * Exports: ColorPanel
 * Depends on: canvas PALETTE, DoneButton
 */

import { Palette } from "lucide-react";
import type { Dispatch, ReactElement, SetStateAction } from "react";
import { PALETTE, type CanvasSpec } from "@/features/canvas";
import type { StudioPage } from "../types";
import { DoneButton } from "./DoneButton";
import { Panel } from "./Panel";

export type ColorPanelProps = {
  spec: CanvasSpec;
  patch: <K extends keyof CanvasSpec>(key: K, value: CanvasSpec[K]) => void;
  setActivePage: Dispatch<SetStateAction<StudioPage>>;
};

/**
 * Render the text color swatch grid.
 * @param props - Spec patcher and done navigation
 * @returns Color editor panel
 */
export function ColorPanel({ spec, patch, setActivePage }: ColorPanelProps): ReactElement {
  return (
    <div className="space-y-4">
      <Panel icon={<Palette />} title="text color">
        <div className="grid grid-cols-7 gap-2">
          {PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => patch("color", color)}
              className={`aspect-square rounded-full border-2 transition ${
                spec.color === color ? "border-white" : "border-white/20"
              }`}
              style={{ background: color }}
              aria-label={`Choose ${color}`}
            />
          ))}
        </div>
      </Panel>
      <DoneButton onClick={() => setActivePage("write")} />
    </div>
  );
}
