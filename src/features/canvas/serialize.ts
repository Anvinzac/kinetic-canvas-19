/**
 * Module providing parseCanvas, serializeCanvas.
 *
 * Exports: parseCanvas, serializeCanvas
 * Depends on: ./catalog, ./types
 */

import { DEFAULT_CANVAS } from "./catalog";
import type { CanvasSpec } from "./types";

/**
 * Parse stored canvas JSON (or plain text fallback) into a CanvasSpec.
 * @param raw - raw argument
 * @returns CanvasSpec merged with defaults; invalid JSON uses raw as `text`
 */
export function parseCanvas(raw: string | null | undefined): CanvasSpec {
  if (!raw) return DEFAULT_CANVAS;
  try {
    const obj = JSON.parse(raw);
    return { ...DEFAULT_CANVAS, ...obj, stickers: Array.isArray(obj.stickers) ? obj.stickers : [] };
  } catch {
    return { ...DEFAULT_CANVAS, text: raw };
  }
}

/**
 * Serialize a CanvasSpec to the JSON string stored in `posts.canvas_html`.
 * @param spec - spec argument
 * @returns JSON string (identical to historical `JSON.stringify(spec)`)
 */
export function serializeCanvas(spec: CanvasSpec): string {
  return JSON.stringify(spec);
}
