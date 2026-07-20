/**
 * MediaRecorder export flow for a kinetic status clip.
 *
 * Exports: usePostExport
 * Depends on: sonner toast, playback-timing getPostExportDuration, export-video helpers
 */

import { useCallback, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import type { Tempo, Rhythm } from "@/features/canvas";
import { getPostExportDuration } from "../lib/playback-timing";
import {
  downloadBlob,
  getExportExtension,
  getPostExportFilename,
  getSupportedExportMimeType,
  wait,
} from "../lib/export-video";
import type { FlowComment, Post } from "../types";

export type UsePostExportArgs = {
  post: Post;
  textPages: string[];
  tempo: Tempo;
  rhythm: Rhythm;
  isExporting: boolean;
  setIsExporting: Dispatch<SetStateAction<boolean>>;
  setActionMenuOpen: Dispatch<SetStateAction<boolean>>;
  setShowChips: Dispatch<SetStateAction<boolean>>;
  setShowQuickCommentChips: Dispatch<SetStateAction<boolean>>;
  setShowCollectionPicker: Dispatch<SetStateAction<boolean>>;
  setStoryOpen: Dispatch<SetStateAction<boolean>>;
  setActiveComment: Dispatch<SetStateAction<FlowComment | null>>;
  setCommentOverlapsInfo: Dispatch<SetStateAction<boolean>>;
  setIsPaused: Dispatch<SetStateAction<boolean>>;
  setPageRevealed: Dispatch<SetStateAction<boolean>>;
  setTextPage: Dispatch<SetStateAction<number>>;
  setBackgroundShiftPage: Dispatch<SetStateAction<number>>;
  setSlide: Dispatch<SetStateAction<number>>;
  setPlayKey: Dispatch<SetStateAction<number>>;
};

export type UsePostExportResult = {
  handleExportVideo: () => Promise<void>;
};

/**
 * Capture the on-screen status as a short video download.
 * @param args - args argument
 * @returns Hook API for callers
 */
export function usePostExport(args: UsePostExportArgs): UsePostExportResult {
  const {
    post,
    textPages,
    tempo,
    rhythm,
    isExporting,
    setIsExporting,
    setActionMenuOpen,
    setShowChips,
    setShowQuickCommentChips,
    setShowCollectionPicker,
    setStoryOpen,
    setActiveComment,
    setCommentOverlapsInfo,
    setIsPaused,
    setPageRevealed,
    setTextPage,
    setBackgroundShiftPage,
    setSlide,
    setPlayKey,
  } = args;

  const handleExportVideo = useCallback(async (): Promise<void> => {
    if (isExporting) return;
    if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === "undefined") {
      toast.error("video export is not supported in this browser");
      return;
    }

    const mimeType = getSupportedExportMimeType();
    if (mimeType === null) {
      toast.error("video export is not supported in this browser");
      return;
    }

    let stream: MediaStream | null = null;
    let recorder: MediaRecorder | null = null;
    const chunks: Blob[] = [];

    try {
      setActionMenuOpen(false);
      setShowChips(false);
      setShowQuickCommentChips(false);
      setShowCollectionPicker(false);
      setStoryOpen(false);
      setActiveComment(null);
      setCommentOverlapsInfo(false);
      toast.info("choose this tab when the recorder opens");
      await wait(250);
      toast.dismiss();

      setIsPaused(false);
      setPageRevealed(false);
      setTextPage(0);
      setBackgroundShiftPage(0);
      setSlide(0);
      setPlayKey((key) => key + 1);
      setIsExporting(true);
      await wait(450);

      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: 30,
          width: { ideal: 1080 },
          height: { ideal: 1920 },
        },
        audio: false,
      });

      if (mimeType && !mimeType.includes("mp4")) {
        toast.info("MP4 is not available here, exporting WebM instead");
      }

      const recorderOptions: MediaRecorderOptions = {
        videoBitsPerSecond: 8_000_000,
        ...(mimeType ? { mimeType } : {}),
      };
      recorder = new MediaRecorder(stream, recorderOptions);
      const recordingFinished = new Promise<void>((resolve, reject) => {
        if (!recorder) {
          reject(new Error("Recorder was not created"));
          return;
        }
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        recorder.onstop = () => resolve();
        recorder.onerror = (event) =>
          reject((event as unknown as { error?: Error }).error ?? new Error("Recording failed"));
      });

      recorder.start(250);
      await wait(getPostExportDuration(textPages, tempo, rhythm));
      if (recorder.state !== "inactive") recorder.stop();
      await recordingFinished;

      const blobType = mimeType || chunks[0]?.type || "video/webm";
      const blob = new Blob(chunks, { type: blobType });
      downloadBlob(blob, getPostExportFilename(post, blobType));
      toast.success(`exported ${getExportExtension(blobType).toUpperCase()} clip`);
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        toast.error("could not export this status");
      }
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
      setIsExporting(false);
    }
  }, [
    isExporting,
    post,
    textPages,
    tempo,
    rhythm,
    setIsExporting,
    setActionMenuOpen,
    setShowChips,
    setShowQuickCommentChips,
    setShowCollectionPicker,
    setStoryOpen,
    setActiveComment,
    setCommentOverlapsInfo,
    setIsPaused,
    setPageRevealed,
    setTextPage,
    setBackgroundShiftPage,
    setSlide,
    setPlayKey,
  ]);

  return { handleExportVideo };
}
