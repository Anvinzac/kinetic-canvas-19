/**
 * Entrance, loop, tempo, and rhythm controls for create-studio.
 *
 * Exports: MotionPanel
 * Depends on: canvas motion enums, Pill, DoneButton
 */

import { SlidersHorizontal, Sparkles } from "lucide-react";
import type { Dispatch, ReactElement, SetStateAction } from "react";
import { ENTRANCES, LOOPS, RHYTHMS, TEMPOS, type CanvasSpec } from "@/features/canvas";
import type { StudioPage } from "../types";
import { DoneButton } from "./DoneButton";
import { Panel } from "./Panel";
import { Pill } from "./Pill";

export type MotionPanelProps = {
  spec: CanvasSpec;
  patch: <K extends keyof CanvasSpec>(key: K, value: CanvasSpec[K]) => void;
  onReplay: () => void;
  setActivePage: Dispatch<SetStateAction<StudioPage>>;
};

/**
 * Render motion preset pill groups.
 * @param props - Spec patcher, replay, and done navigation
 * @returns Motion editor panel
 */
export function MotionPanel({
  spec,
  patch,
  onReplay,
  setActivePage,
}: MotionPanelProps): ReactElement {
  return (
    <div className="space-y-4">
      <Panel icon={<Sparkles />} title="entrance">
        <div className="flex flex-wrap gap-2">
          {ENTRANCES.map((entrance) => (
            <Pill
              key={entrance}
              active={spec.entrance === entrance}
              onClick={() => {
                patch("entrance", entrance);
                onReplay();
              }}
            >
              {entrance}
            </Pill>
          ))}
        </div>
      </Panel>

      <Panel icon={<Sparkles />} title="loop">
        <div className="flex flex-wrap gap-2">
          {LOOPS.map((loop) => (
            <Pill key={loop} active={spec.loop === loop} onClick={() => patch("loop", loop)}>
              {loop}
            </Pill>
          ))}
        </div>
      </Panel>

      <Panel icon={<SlidersHorizontal />} title="speed">
        <div className="flex flex-wrap gap-2">
          {TEMPOS.map((tempo) => (
            <Pill
              key={tempo}
              active={spec.tempo === tempo}
              onClick={() => {
                patch("tempo", tempo);
                onReplay();
              }}
            >
              {tempo}
            </Pill>
          ))}
        </div>
      </Panel>

      <Panel icon={<Sparkles />} title="rhythm">
        <div className="flex flex-wrap gap-2">
          {RHYTHMS.map((rhythm) => (
            <Pill
              key={rhythm}
              active={spec.rhythm === rhythm}
              onClick={() => {
                patch("rhythm", rhythm);
                onReplay();
              }}
            >
              {rhythm}
            </Pill>
          ))}
        </div>
      </Panel>
      <DoneButton onClick={() => setActivePage("write")} />
    </div>
  );
}
