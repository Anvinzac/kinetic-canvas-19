/**
 * Photo, upload, and video pickers for create-studio backgrounds.
 *
 * Exports: BackgroundMediaBody
 * Depends on: create-studio PRELOADED_PHOTOS/VIDEOS
 */

import { Check, Upload, Video } from "lucide-react";
import type { Dispatch, ReactElement, SetStateAction } from "react";
import { PRELOADED_PHOTOS, PRELOADED_VIDEOS } from "../lib/templates";
import type { BackgroundMode } from "../types";

export type BackgroundMediaBodyProps = {
  backgroundMode: Extract<BackgroundMode, "photo" | "upload" | "video">;
  selectedPhoto: string;
  setSelectedPhoto: Dispatch<SetStateAction<string>>;
  selectedVideo: string;
  setSelectedVideo: Dispatch<SetStateAction<string>>;
  setBackgroundMode: Dispatch<SetStateAction<BackgroundMode>>;
  uploadedPhoto: string | null;
  onUpload: (file: File | undefined) => void;
};

/**
 * Render media background mode pickers.
 * @param props - Active media mode and selection/upload state
 * @returns Media mode body
 */
export function BackgroundMediaBody({
  backgroundMode,
  selectedPhoto,
  setSelectedPhoto,
  selectedVideo,
  setSelectedVideo,
  setBackgroundMode,
  uploadedPhoto,
  onUpload,
}: BackgroundMediaBodyProps): ReactElement {
  if (backgroundMode === "photo") {
    return (
      <div className="mt-3 grid grid-cols-3 gap-2">
        {PRELOADED_PHOTOS.map((photo) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => {
              setSelectedPhoto(photo.url);
              setBackgroundMode("photo");
            }}
            className={`relative aspect-[3/4] overflow-hidden rounded-2xl ring-2 transition ${
              selectedPhoto === photo.url ? "ring-white" : "ring-transparent"
            }`}
          >
            <img src={photo.url} alt="" className="absolute inset-0 size-full object-cover" />
            <span className="absolute inset-x-1 bottom-1 rounded-full bg-black/45 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
              {photo.label}
            </span>
          </button>
        ))}
      </div>
    );
  }

  if (backgroundMode === "upload") {
    return (
      <div className="mt-3">
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-white/25 bg-white/5 px-4 py-5 text-sm font-bold transition hover:border-primary/70">
          <Upload className="size-4" />
          choose from library
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => onUpload(event.target.files?.[0])}
          />
        </label>
        {uploadedPhoto && (
          <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white/5 p-2 ring-1 ring-white/10">
            <img
              src={uploadedPhoto}
              alt=""
              className="aspect-[3/4] h-20 rounded-xl object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">library photo loaded</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                used as background image
              </p>
            </div>
            <Check className="size-4 text-primary" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 grid gap-2">
      {PRELOADED_VIDEOS.map((video) => (
        <button
          key={video.id}
          type="button"
          onClick={() => {
            setSelectedVideo(video.url);
            setBackgroundMode("video");
          }}
          className={`relative aspect-[9/16] max-h-64 w-full overflow-hidden rounded-2xl text-left ring-2 transition ${
            selectedVideo === video.url ? "ring-white" : "ring-transparent"
          }`}
        >
          <video
            src={video.url}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 size-full object-cover"
          />
          <span className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/60" />
          <span className="absolute bottom-2 left-2 flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
            <Video className="size-3.5" />
            {video.label}
          </span>
        </button>
      ))}
    </div>
  );
}
