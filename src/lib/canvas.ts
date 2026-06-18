// CanvasSpec — kinetic typography specification stored as JSON in posts.canvas_html
// Kept compact (<1KB typical, <1MB hard cap)

export type Entrance = "fade" | "slide" | "scale" | "blur" | "split";
export type Loop = "pulse" | "float" | "shake" | "none";
export type Tempo = "slow" | "steady" | "snappy";
export type Rhythm = "smooth" | "stagger" | "burst";

export interface CanvasSpec {
  text: string;
  font: string; // "Inter" | "Space Grotesk" | "Bebas Neue" | "Playfair Display" | "JetBrains Mono"
  size: number; // px
  color: string; // hex/oklch
  weight: number; // 100-900
  letterSpacing: number; // em
  x: number; // 0-100 (% of container)
  y: number; // 0-100
  entrance: Entrance;
  loop: Loop;
  tempo: Tempo;
  rhythm: Rhythm;
  rotation: number; // degrees
}

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
export const RHYTHMS: Rhythm[] = ["smooth", "stagger", "burst"];

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
  "linear-gradient(135deg,#073B4C,#06D6A0)",
  "linear-gradient(135deg,#9D4EDD,#FF006E)",
  "linear-gradient(180deg,#000000,#1a1a2e)",
];

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

export function parseCanvas(raw: string | null | undefined): CanvasSpec {
  if (!raw) return DEFAULT_CANVAS;
  try {
    const obj = JSON.parse(raw);
    return { ...DEFAULT_CANVAS, ...obj };
  } catch {
    return { ...DEFAULT_CANVAS, text: raw };
  }
}

export function serializeCanvas(spec: CanvasSpec): string {
  return JSON.stringify(spec);
}
