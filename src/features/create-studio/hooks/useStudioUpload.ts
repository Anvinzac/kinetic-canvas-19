/**
 * Library photo upload for create-studio background mode.
 *
 * Exports: useStudioUpload
 * Depends on: create-studio lib/read-file, sonner
 */

import { toast } from "sonner";
import type { Dispatch, SetStateAction } from "react";
import { readFileAsDataUrl } from "../lib/read-file";
import type { BackgroundMode } from "../types";

export type StudioUploadApi = {
  handleUpload: (file: File | undefined) => Promise<void>;
};

type UseStudioUploadArgs = {
  setUploadedPhoto: Dispatch<SetStateAction<string | null>>;
  setBackgroundMode: Dispatch<SetStateAction<BackgroundMode>>;
};

/**
 * Validate and load an image file as the upload background.
 * @param args - Upload photo + background mode setters
 * @returns handleUpload for file inputs
 */
export function useStudioUpload({
  setUploadedPhoto,
  setBackgroundMode,
}: UseStudioUploadArgs): StudioUploadApi {
  async function handleUpload(file: File | undefined): Promise<void> {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("choose an image file");
      return;
    }
    if (file.size > 3_000_000) {
      toast.error("choose an image under 3MB");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setUploadedPhoto(dataUrl);
      setBackgroundMode("upload");
      toast.success("photo loaded");
    } catch {
      toast.error("could not load that photo");
    }
  }

  return { handleUpload };
}
