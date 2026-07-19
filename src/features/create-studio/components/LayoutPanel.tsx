/**
 * Text placement controls for create-studio.
 *
 * Exports: LayoutPanel
 * Depends on: create-studio PLACEMENTS, DoneButton
 */

import { Move } from "lucide-react";
import type { Dispatch, ReactElement, SetStateAction } from "react";
import type { CanvasSpec } from "@/features/canvas";
import { PLACEMENTS } from "../lib/templates";
import type { StudioPage } from "../types";
import { DoneButton } from "./DoneButton";
import { Panel } from "./Panel";

export type LayoutPanelProps = {
  spec: CanvasSpec;
  updatePlacement: (x: number, y: number) => void;
  setActivePage: Dispatch<SetStateAction<StudioPage>>;
};

/**
 * Render placement preset buttons.
 * @param props - Current spec, placement updater, and done navigation
 * @returns Layout editor panel
 */
export function LayoutPanel({
  spec,
  updatePlacement,
  setActivePage,
}: LayoutPanelProps): ReactElement {
  return (
    <div className="space-y-4">
      <Panel icon={<Move />} title="placement">
        <div className="grid grid-cols-3 gap-2">
          {PLACEMENTS.map((placement) => (
            <button
              key={placement.label}
              type="button"
              onClick={() => updatePlacement(placement.x, placement.y)}
              className={`rounded-xl px-3 py-3 text-xs font-bold ${
                spec.y === placement.y ? "bg-white text-black" : "bg-white/10 text-white"
              }`}
            >
              {placement.label}
            </button>
          ))}
        </div>
      </Panel>
      <DoneButton onClick={() => setActivePage("write")} />
    </div>
  );
}
