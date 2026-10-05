/**
 * Video-export layouts for the vocabulary card.
 *
 * A social app draws its own interface over the video: a button column down the
 * right edge, a caption and sound line across the bottom, tabs across the top. A
 * preset is the frame size plus the margins a card must keep clear so none of that
 * lands on a word. The margins are fractions of the frame, so they hold at any
 * capture size.
 *
 * The numbers are working margins drawn from the platforms' published safe-zone
 * guidance for a 1080×1920 frame, rounded outward. They are deliberately generous:
 * a caption that runs to several lines, or a phone with a tall status bar, eats
 * further into the frame than the minimum figures suggest.
 *
 * Exports: EXPORT_PRESETS, DEFAULT_EXPORT_PRESET_ID, getExportPreset,
 *   EXPORT_FRAME_RATES, getExportMimeType, getExportFileName, describeSharpness
 * Depends on: none (leaf module)
 */

/** Margins as fractions (0–1) of the frame's own width / height. */
export type SafeInsets = { top: number; right: number; bottom: number; left: number };

/** Which app's interface the preview should sketch over the frame. */
export type PlatformGuide = "tiktok" | "reels" | "none";

export type ExportPreset = {
  id: string;
  label: string;
  /** One line on what this layout is for, shown under the label. */
  summary: string;
  /** Output frame in pixels. */
  width: number;
  height: number;
  safe: SafeInsets;
  guide: PlatformGuide;
};

export const EXPORT_PRESETS: readonly ExportPreset[] = [
  {
    id: "tiktok-clear",
    label: "TikTok · clear",
    summary: "Text sits left of the button column and above the caption. Nothing is ever covered.",
    width: 1080,
    height: 1920,
    // Right edge: the like/comment/share column. Bottom: handle, caption (allowing
    // for a second and third line) and the sound ticker.
    safe: { top: 0.085, right: 0.15, bottom: 0.25, left: 0.05 },
    guide: "tiktok",
  },
  {
    id: "tiktok-centred",
    label: "TikTok · centred",
    summary:
      "Same clear zone, mirrored on the left so the text is centred in the frame. Narrower, calmer.",
    width: 1080,
    height: 1920,
    safe: { top: 0.085, right: 0.15, bottom: 0.25, left: 0.15 },
    guide: "tiktok",
  },
  {
    id: "reels",
    label: "Reels · Facebook & Instagram",
    summary: "Meta keeps more of the bottom for the caption, so the text rides higher.",
    width: 1080,
    height: 1920,
    safe: { top: 0.14, right: 0.06, bottom: 0.35, left: 0.06 },
    guide: "reels",
  },
  {
    id: "full",
    label: "Full frame 9:16",
    summary: "The card as it looks in the app, edge to edge. For Stories, Shorts or your own edit.",
    width: 1080,
    height: 1920,
    safe: { top: 0.04, right: 0.04, bottom: 0.05, left: 0.04 },
    guide: "none",
  },
  {
    id: "feed",
    label: "Facebook feed 4:5",
    summary: "The tallest shape a feed post shows without cropping. No interface on top of it.",
    width: 1080,
    height: 1350,
    safe: { top: 0.05, right: 0.05, bottom: 0.06, left: 0.05 },
    guide: "none",
  },
];

export const DEFAULT_EXPORT_PRESET_ID = "tiktok-clear";

/** Look a preset up by id, falling back to the default. @pure true */
export function getExportPreset(id: string | null | undefined): ExportPreset {
  return (
    EXPORT_PRESETS.find((preset) => preset.id === id) ??
    EXPORT_PRESETS.find((preset) => preset.id === DEFAULT_EXPORT_PRESET_ID)!
  );
}

export const EXPORT_FRAME_RATES = [30, 60] as const;
export type ExportFrameRate = (typeof EXPORT_FRAME_RATES)[number];

/** H.264 + AAC first: it is the one container every platform's uploader accepts. */
const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.640028,mp4a.40.2",
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4;codecs=avc1",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
] as const;

/**
 * The best container this browser can record to.
 * @returns A MediaRecorder mime type, or null when recording is unavailable
 */
export function getExportMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

/**
 * File name for an exported clip: brand, word, layout.
 * @param word - the answer on the card
 * @param presetId - layout the clip was recorded in
 * @param mimeType - recorded container
 * @pure true
 */
export function getExportFileName(word: string, presetId: string, mimeType: string): string {
  const slug =
    word
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "word";
  return `anh-chay-la-${slug}-${presetId}.${mimeType.includes("mp4") ? "mp4" : "webm"}`;
}

/**
 * How sharp a recording will be. The clip is captured from the screen, so its true
 * detail is the stage's on-screen height in device pixels; anything short of the
 * output height is scaled up to fit.
 * @param stageCssHeight - on-screen stage height in CSS pixels
 * @param devicePixelRatio - the display's pixel ratio
 * @param outputHeight - preset frame height
 * @returns Captured pixel height, its share of the output, and a plain verdict
 * @pure true
 */
export function describeSharpness(
  stageCssHeight: number,
  devicePixelRatio: number,
  outputHeight: number,
): { capturedHeight: number; ratio: number; verdict: "full" | "good" | "soft" } {
  const capturedHeight = Math.round(stageCssHeight * devicePixelRatio);
  const ratio = outputHeight > 0 ? Math.min(1, capturedHeight / outputHeight) : 0;
  return {
    capturedHeight,
    ratio,
    verdict: ratio >= 0.98 ? "full" : ratio >= 0.7 ? "good" : "soft",
  };
}
