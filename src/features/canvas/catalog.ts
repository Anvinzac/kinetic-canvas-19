/**
 * Module providing SAFE_CANVAS_BACKGROUND, DEFAULT_CANVAS, FONTS, ENTRANCES.
 *
 * Exports: SAFE_CANVAS_BACKGROUND, DEFAULT_CANVAS, FONTS, ENTRANCES, LOOPS, TEMPOS, RHYTHMS, PALETTE, GRADIENTS, TRANSITION_GRADIENT_PATHS, COMMENT_CHIPS
 * Depends on: ./types
 */

import type {
  CanvasSpec,
  Entrance,
  GradientTransitionPath,
  Loop,
  Rhythm,
  Tempo,
} from "./types";

export const SAFE_CANVAS_BACKGROUND = "linear-gradient(135deg,#00B4D8,#FF006E)";

/**
 * @responsibility Default CanvasSpec used when parse fails or a new draft starts.
 * @pure true
 */
export const DEFAULT_CANVAS: CanvasSpec = {
  text: "TYPE.",
  font: "Space Grotesk",
  size: 96,
  color: "#ffffff",
  weight: 900,
  letterSpacing: -0.04,
  x: 50,
  y: 50,
  entrance: "scale",
  loop: "pulse",
  tempo: "steady",
  rhythm: "stagger",
  rotation: 0,
  link: null,
  stickers: [],
  backgroundStyle: "static",
  gradientPath: [],
};

export const FONTS = [
  "Inter",
  "Space Grotesk",
  "Bebas Neue",
  "Playfair Display",
  "JetBrains Mono",
] as const;
export const ENTRANCES: Entrance[] = ["fade", "slide", "scale", "blur", "split"];
export const LOOPS: Loop[] = ["pulse", "float", "shake", "none"];
export const TEMPOS: Tempo[] = ["slow", "steady", "snappy"];
export const RHYTHMS: Rhythm[] = ["smooth", "stagger", "burst", "poetic"];

export const PALETTE = [
  "#ffffff",
  "#FF006E",
  "#06FFA5",
  "#FFBE0B",
  "#3A86FF",
  "#8338EC",
  "#000000",
];

export const GRADIENTS = [
  "linear-gradient(135deg,#FF006E,#8338EC)",
  "linear-gradient(135deg,#06FFA5,#00B4D8)",
  "linear-gradient(135deg,#FB5607,#FFBE0B)",
  "linear-gradient(135deg,#3A86FF,#8338EC)",
  "linear-gradient(135deg,#F72585,#7209B7)",
  "linear-gradient(135deg,#FFD60A,#FF006E)",
  "linear-gradient(135deg,#06D6A0,#118AB2)",
  "linear-gradient(135deg,#00B4D8,#FF006E)",
  "linear-gradient(135deg,#9D4EDD,#FF006E)",
  "linear-gradient(135deg,#F8C8DC,#7C3AED)",
  SAFE_CANVAS_BACKGROUND,
];

export const TRANSITION_GRADIENT_PATHS: readonly GradientTransitionPath[] = [
  {
    id: "aurora-rush",
    label: "aurora rush",
    mood: "hot pink -> electric blue -> acid green",
    gradients: [
      "linear-gradient(135deg,#FF006E,#8338EC)",
      "linear-gradient(135deg,#8338EC,#3A86FF)",
      "linear-gradient(135deg,#3A86FF,#06FFA5)",
      "linear-gradient(135deg,#06FFA5,#FFBE0B)",
      "linear-gradient(135deg,#FFBE0B,#FF006E)",
    ],
  },
  {
    id: "solar-wave",
    label: "solar wave",
    mood: "sunset -> lagoon -> violet flash",
    gradients: [
      "linear-gradient(135deg,#FB5607,#FFBE0B)",
      "linear-gradient(135deg,#FFBE0B,#06FFA5)",
      "linear-gradient(135deg,#06FFA5,#00B4D8)",
      "linear-gradient(135deg,#00B4D8,#9D4EDD)",
      "linear-gradient(135deg,#9D4EDD,#FF006E)",
    ],
  },
  {
    id: "prism-drift",
    label: "prism drift",
    mood: "rose -> mint -> cobalt -> gold",
    gradients: [
      "linear-gradient(135deg,#F72585,#7209B7)",
      "linear-gradient(135deg,#7209B7,#06D6A0)",
      "linear-gradient(135deg,#06D6A0,#F9F871)",
      "linear-gradient(135deg,#F9F871,#3A86FF)",
      "linear-gradient(135deg,#3A86FF,#FFBE0B)",
    ],
  },
  {
    id: "rose-lullaby",
    label: "rose lullaby",
    mood: "blush -> lavender -> moonlit blue",
    gradients: [
      "linear-gradient(135deg,#F8C8DC,#7C3AED)",
      "linear-gradient(135deg,#7C3AED,#3A86FF)",
      "linear-gradient(135deg,#3A86FF,#B8F7D4)",
      "linear-gradient(135deg,#B8F7D4,#F8C8DC)",
    ],
  },
] as const;

export const COMMENT_CHIPS: { id: string; emoji: string; label: string }[] = [
  { id: "fire", emoji: "🔥", label: "fire" },
  { id: "heart", emoji: "❤️", label: "love" },
  { id: "wow", emoji: "😮", label: "wow" },
  { id: "laugh", emoji: "😂", label: "lol" },
  { id: "clap", emoji: "👏", label: "clap" },
  { id: "mind-blown", emoji: "🤯", label: "mind blown" },
  { id: "obsessed", emoji: "✨", label: "obsessed" },
  { id: "vibe", emoji: "🌀", label: "vibe" },
  { id: "genius", emoji: "🧠", label: "genius" },
  { id: "goals", emoji: "🎯", label: "goals" },
];
