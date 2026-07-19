/**
 * UI component: page-backdrop.
 *
 * Exports: getPageBackdropActionLabel, getPageBackdropActionIcon
 * Depends on: lucide-react
 */

import { Image as ImageIcon, Palette, Video } from "lucide-react";
import type { ReactElement } from "react";
import type { BackgroundMode } from "../types";

/**
 * Label the per-page backdrop edit action for the current mode.
 * @param backgroundMode - backgroundMode argument
 * @returns Computed value
 */
export function getPageBackdropActionLabel(backgroundMode: BackgroundMode): string {
  if (backgroundMode === "video") return "change video";
  if (backgroundMode === "photo" || backgroundMode === "upload") return "change image";
  return "background";
}

/**
 * Icon for the per-page backdrop edit action.
 * @param backgroundMode - backgroundMode argument
 * @returns Computed value
 */
export function getPageBackdropActionIcon(backgroundMode: BackgroundMode): ReactElement {
  if (backgroundMode === "video") return <Video className="size-3" />;
  if (backgroundMode === "photo" || backgroundMode === "upload") {
    return <ImageIcon className="size-3" />;
  }
  return <Palette className="size-3" />;
}
