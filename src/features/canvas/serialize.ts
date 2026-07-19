import { DEFAULT_CANVAS } from "./catalog";
import type { CanvasSpec } from "./types";

/**
 * @responsibility Parse stored canvas JSON (or plain text fallback) into a CanvasSpec.
 * @inputs raw string from `posts.canvas_html` (JSON, plain text, null/undefined)
 * @outputs CanvasSpec merged with defaults; invalid JSON uses raw as `text`
 * @pure true
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
 * @responsibility Serialize a CanvasSpec to the JSON string stored in `posts.canvas_html`.
 * @inputs CanvasSpec
 * @outputs JSON string (identical to historical `JSON.stringify(spec)`)
 * @pure true
 */
export function serializeCanvas(spec: CanvasSpec): string {
  return JSON.stringify(spec);
}
