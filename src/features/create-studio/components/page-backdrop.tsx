import { Image as ImageIcon, Palette, Video } from "lucide-react";
import type { BackgroundMode } from "../types";

/**
 * @responsibility Label the per-page backdrop edit action for the current mode.
 * @pure true
 */
export function getPageBackdropActionLabel(backgroundMode: BackgroundMode) {
  if (backgroundMode === "video") return "change video";
  if (backgroundMode === "photo" || backgroundMode === "upload") return "change image";
  return "background";
}

/**
 * @responsibility Icon for the per-page backdrop edit action.
 */
export function getPageBackdropActionIcon(backgroundMode: BackgroundMode) {
  if (backgroundMode === "video") return <Video className="size-3" />;
  if (backgroundMode === "photo" || backgroundMode === "upload") {
    return <ImageIcon className="size-3" />;
  }
  return <Palette className="size-3" />;
}
