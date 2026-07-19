/**
 * Watermark overlay shown while exporting a status video.
 *
 * Exports: ExportWatermark
 * Depends on: Profile type
 */

import type { ReactElement } from "react";
import type { Profile } from "../types";

/**
 * @responsibility Brand watermark burned into exported clips.
 */
export function ExportWatermark({ author }: { author?: Profile }): ReactElement {
  return (
    <div className="pointer-events-none absolute right-4 top-4 z-20 flex items-center gap-2 rounded-full bg-black/18 px-2.5 py-2 text-white shadow-[0_8px_28px_rgba(0,0,0,0.25)] ring-1 ring-white/20 backdrop-blur-[2px]">
      <span className="grid size-7 place-items-center rounded-full bg-white text-[13px] font-black leading-none text-black shadow-[0_4px_18px_rgba(0,0,0,0.25)]">
        K
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-mono text-[10px] font-black uppercase tracking-[0.22em] text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.6)]">
          Kinetic
        </span>
        <span className="mt-1 max-w-24 truncate font-mono text-[8px] uppercase tracking-[0.14em] text-white/70 drop-shadow-[0_1px_8px_rgba(0,0,0,0.65)]">
          (C) {author ? `@${author.username}` : "original"}
        </span>
      </span>
    </div>
  );
}

