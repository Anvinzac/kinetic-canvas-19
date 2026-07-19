/**
 * Browser MediaRecorder helpers for exporting a status clip.
 *
 * Exports: getSupportedExportMimeType, getExportExtension, getPostExportFilename, downloadBlob, wait
 * Depends on: Post type
 */

import type { Post } from "../types";

/**
 * Compute supportedexportmimetype.
 * @returns Computed value
 */
export function getSupportedExportMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return (
    [
      "video/mp4;codecs=h264",
      "video/mp4;codecs=avc1",
      "video/mp4",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ].find((type) => MediaRecorder.isTypeSupported(type)) ?? ""
  );
}

/**
 * Compute exportextension.
 * @param mimeType - mimeType argument
 * @returns Computed value
 */
export function getExportExtension(mimeType: string): string {
  return mimeType.includes("mp4") ? "mp4" : "webm";
}

/**
 * Compute postexportfilename.
 * @param post - post argument
 * @param mimeType - mimeType argument
 * @returns Computed value
 */
export function getPostExportFilename(post: Post, mimeType: string): string {
  return `kinetic-${post.id.slice(0, 8)}.${getExportExtension(mimeType)}`;
}

/**
 * downloadBlob helper
 * @param blob - blob argument
 * @param filename - filename argument
 * @returns Function result
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * wait helper
 * @param ms - ms argument
 * @returns Function result
 */
export function wait(ms: number): Promise<void> {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}
