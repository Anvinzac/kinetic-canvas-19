import {
  DEFAULT_CANVAS,
  GRADIENTS,
  SAFE_CANVAS_BACKGROUND,
  TRANSITION_GRADIENT_PATHS,
  type CanvasSpec,
  type GradientTransitionPath,
} from "@/features/canvas";
import type { AnimationTemplate, BackgroundMode, StudioPage } from "../types";

export const STATUS_CANVAS: CanvasSpec = {
  ...DEFAULT_CANVAS,
  text: "",
  size: 96,
  x: 50,
  y: 50,
  entrance: "scale",
  loop: "pulse",
};

export const PRELOADED_PHOTOS = [
  {
    id: "city",
    label: "city glow",
    url: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "forest",
    label: "green quiet",
    url: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "room",
    label: "warm room",
    url: "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "road",
    label: "open road",
    url: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "field",
    label: "soft field",
    url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
  },
];

export const PRELOADED_VIDEOS = [
  {
    id: "flower",
    label: "soft motion",
    url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  },
];

export const PLACEMENTS = [
  { label: "top", x: 50, y: 32 },
  { label: "center", x: 50, y: 50 },
  { label: "low", x: 50, y: 68 },
];

export const ANIMATION_TEMPLATES: AnimationTemplate[] = [
  {
    id: "paper-headline",
    label: "paper headline",
    mood: "scene · editorial",
    backdrop: { mode: "scene", sceneId: "paper-cut-sunrise" },
    spec: {
      font: "Bebas Neue",
      size: 112,
      color: "#ffffff",
      weight: 900,
      letterSpacing: -0.02,
      entrance: "slide",
      loop: "pulse",
      tempo: "steady",
      rhythm: "burst",
      x: 50,
      y: 50,
      rotation: -1,
      backgroundScene: "paper-cut-sunrise",
    },
  },
  {
    id: "rose-verse",
    label: "rose verse",
    mood: "slow · poetic",
    backdrop: { mode: "gradient", gradient: "linear-gradient(135deg,#F8C8DC,#7C3AED)" },
    spec: {
      font: "Playfair Display",
      size: 98,
      color: "#FFF7ED",
      weight: 700,
      letterSpacing: -0.015,
      entrance: "blur",
      loop: "float",
      tempo: "slow",
      rhythm: "poetic",
      x: 50,
      y: 52,
      rotation: -1,
    },
  },
  {
    id: "ink-memo",
    label: "ink memo",
    mood: "scene · quiet print",
    backdrop: { mode: "scene", sceneId: "paper-cut-noir" },
    spec: {
      font: "Playfair Display",
      size: 96,
      color: "#FFF7ED",
      weight: 800,
      letterSpacing: -0.015,
      entrance: "blur",
      loop: "float",
      tempo: "slow",
      rhythm: "poetic",
      x: 50,
      y: 54,
      rotation: 0,
      backgroundScene: "paper-cut-noir",
    },
  },
  {
    id: "pattern-current",
    label: "pattern current",
    mood: "continuous · seamless",
    backdrop: { mode: "pattern", patternId: "waves" },
    spec: {
      font: "Space Grotesk",
      size: 100,
      color: "#ffffff",
      weight: 900,
      letterSpacing: -0.035,
      entrance: "slide",
      loop: "float",
      tempo: "steady",
      rhythm: "smooth",
      x: 50,
      y: 52,
      rotation: 0,
      backgroundPattern: "waves",
    },
  },
  {
    id: "aqua-fold",
    label: "aqua fold",
    mood: "scene · cool cut",
    backdrop: { mode: "scene", sceneId: "paper-cut-aqua" },
    spec: {
      font: "Space Grotesk",
      size: 102,
      color: "#ffffff",
      weight: 900,
      letterSpacing: -0.04,
      entrance: "split",
      loop: "float",
      tempo: "steady",
      rhythm: "stagger",
      x: 50,
      y: 51,
      rotation: 1,
      backgroundScene: "paper-cut-aqua",
    },
  },
  {
    id: "neon-burst",
    label: "neon burst",
    mood: "snappy · burst",
    backdrop: { mode: "gradient", gradient: "linear-gradient(135deg,#FF006E,#8338EC)" },
    spec: {
      font: "Bebas Neue",
      size: 114,
      color: "#ffffff",
      weight: 900,
      letterSpacing: -0.02,
      entrance: "scale",
      loop: "pulse",
      tempo: "snappy",
      rhythm: "burst",
      x: 50,
      y: 50,
      rotation: -1,
    },
  },
  {
    id: "photo-memory",
    label: "photo memory",
    mood: "image · cinematic",
    backdrop: { mode: "photo", url: PRELOADED_PHOTOS[4].url },
    spec: {
      font: "Playfair Display",
      size: 98,
      color: "#FFF7ED",
      weight: 800,
      letterSpacing: -0.015,
      entrance: "blur",
      loop: "float",
      tempo: "slow",
      rhythm: "poetic",
      x: 50,
      y: 56,
      rotation: -1,
    },
  },
  {
    id: "editorial-drift",
    label: "editorial drift",
    mood: "slow · smooth",
    backdrop: { mode: "gradient", gradient: "linear-gradient(135deg,#00B4D8,#FF006E)" },
    spec: {
      font: "Playfair Display",
      size: 100,
      color: "#ffffff",
      weight: 800,
      letterSpacing: -0.02,
      entrance: "blur",
      loop: "float",
      tempo: "slow",
      rhythm: "smooth",
      x: 50,
      y: 50,
      rotation: -2,
    },
  },
  {
    id: "video-bloom",
    label: "video bloom",
    mood: "video · living backdrop",
    backdrop: { mode: "video", url: PRELOADED_VIDEOS[0].url },
    spec: {
      font: "Inter",
      size: 96,
      color: "#ffffff",
      weight: 900,
      letterSpacing: -0.035,
      entrance: "fade",
      loop: "pulse",
      tempo: "steady",
      rhythm: "stagger",
      x: 50,
      y: 50,
      rotation: 0,
    },
  },
  {
    id: "mono-sprint",
    label: "mono sprint",
    mood: "snappy · stagger",
    backdrop: { mode: "gradient", gradient: "linear-gradient(135deg,#00B4D8,#FF006E)" },
    spec: {
      font: "JetBrains Mono",
      size: 88,
      color: "#06FFA5",
      weight: 800,
      letterSpacing: -0.04,
      entrance: "split",
      loop: "shake",
      tempo: "snappy",
      rhythm: "stagger",
      x: 50,
      y: 55,
      rotation: 0,
    },
  },
  {
    id: "soft-signal",
    label: "soft signal",
    mood: "steady · smooth",
    backdrop: { mode: "gradient", gradient: "linear-gradient(135deg,#3A86FF,#06FFA5)" },
    spec: {
      font: "Inter",
      size: 98,
      color: "#ffffff",
      weight: 850,
      letterSpacing: -0.03,
      entrance: "fade",
      loop: "float",
      tempo: "steady",
      rhythm: "smooth",
      x: 50,
      y: 48,
      rotation: 0,
    },
  },
  {
    id: "poster-pop",
    label: "poster pop",
    mood: "steady · burst",
    backdrop: { mode: "gradient", gradient: "linear-gradient(135deg,#FB5607,#FFBE0B)" },
    spec: {
      font: "Space Grotesk",
      size: 108,
      color: "#000000",
      weight: 900,
      letterSpacing: -0.05,
      entrance: "slide",
      loop: "pulse",
      tempo: "steady",
      rhythm: "burst",
      x: 50,
      y: 46,
      rotation: 1,
    },
  },
];

export const PAGE_TITLES: Record<StudioPage, { title: string; subtitle: string }> = {
  write: { title: "STATUS STUDIO", subtitle: "type · preview · post" },
  background: { title: "BACKGROUND", subtitle: "gradient · flow · photo" },
  font: { title: "FONT", subtitle: "family · scale · weight" },
  color: { title: "COLOR", subtitle: "text tone" },
  layout: { title: "LAYOUT", subtitle: "placement" },
  motion: { title: "MOTION", subtitle: "style · speed · rhythm" },
};

export const DEFAULT_TRANSITION_PATH: GradientTransitionPath = TRANSITION_GRADIENT_PATHS[0] ?? {
  id: "aurora-rush",
  label: "aurora rush",
  mood: "hot pink -> electric blue -> acid green",
  gradients: [GRADIENTS[0], GRADIENTS[1], SAFE_CANVAS_BACKGROUND],
};

/**
 * @responsibility Decide whether a template matches the current composer motion + backdrop.
 * @pure true
 */
export function isTemplateActive(
  template: AnimationTemplate,
  spec: CanvasSpec,
  bg: string,
  backgroundMode: BackgroundMode,
  selectedGradientPath: GradientTransitionPath,
  selectedSceneId: string,
  selectedPatternId: string,
  selectedPhoto: string,
  selectedVideo: string,
) {
  const motionMatches =
    spec.font === template.spec.font &&
    spec.entrance === template.spec.entrance &&
    spec.loop === template.spec.loop &&
    spec.tempo === template.spec.tempo &&
    spec.rhythm === template.spec.rhythm;
  if (!motionMatches) return false;

  if (template.backdrop.mode === "gradient") {
    return backgroundMode === "gradient" && bg === template.backdrop.gradient;
  }
  if (template.backdrop.mode === "transition") {
    return backgroundMode === "transition" && selectedGradientPath.id === template.backdrop.path.id;
  }
  if (template.backdrop.mode === "scene") {
    return backgroundMode === "scene" && selectedSceneId === template.backdrop.sceneId;
  }
  if (template.backdrop.mode === "pattern") {
    return backgroundMode === "pattern" && selectedPatternId === template.backdrop.patternId;
  }
  if (template.backdrop.mode === "photo") {
    return backgroundMode === "photo" && selectedPhoto === template.backdrop.url;
  }
  return backgroundMode === "video" && selectedVideo === template.backdrop.url;
}
