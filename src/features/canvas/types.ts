/**
 * @responsibility Kinetic typography entrance animation kind.
 * @pure true
 */
export type Entrance = "fade" | "slide" | "scale" | "blur" | "split";

/**
 * @responsibility Idle loop animation applied after entrance.
 * @pure true
 */
export type Loop = "pulse" | "float" | "shake" | "none";

/**
 * @responsibility Playback speed bucket for canvas motion.
 * @pure true
 */
export type Tempo = "slow" | "steady" | "snappy";

/**
 * @responsibility Word-reveal timing pattern for kinetic text.
 * @pure true
 */
export type Rhythm = "smooth" | "stagger" | "burst" | "poetic";

/**
 * @responsibility Whether the backdrop is a fixed gradient or a transition path.
 * @pure true
 */
export type BackgroundStyle = "static" | "transition";

/**
 * @responsibility Link chip preview embedded on a canvas post.
 * @pure true
 */
export interface CanvasLinkPreview {
  url: string;
  host: string;
  title: string;
}

/**
 * @responsibility Draggable emoji/gif sticker placed on the canvas.
 * @pure true
 */
export interface CanvasSticker {
  id: string;
  kind: "emoji" | "gif";
  word: string;
  emoji?: string;
  url?: string;
  title?: string;
  x: number;
  y: number;
  size: number;
}

/**
 * CanvasSpec — kinetic typography specification stored as JSON in posts.canvas_html.
 * Kept compact (<1KB typical, <1MB hard cap).
 *
 * @responsibility Describe a kinetic canvas post: text, motion, stickers, and backdrop ids.
 * @inputs Stored as JSON in `posts.canvas_html` or built in the create flow
 * @outputs Normalized fields for KineticText, PostCard, and serialize/parse
 * @pure true
 */
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
  link?: CanvasLinkPreview | null;
  stickers?: CanvasSticker[];
  backgroundStyle?: BackgroundStyle;
  gradientPath?: string[];
  // Id of a seamless tiling pattern backdrop (see patterns.ts). When set,
  // it replaces the gradient backdrop and pans a fixed step per page turn.
  backgroundPattern?: string;
  // Id of a generated layered scene backdrop (see scenes.ts). Scenes are
  // composed from CSS sheets/textures rather than gradients, photos, or videos.
  backgroundScene?: string;
}

/**
 * @responsibility Named multi-stop gradient path used for transition backdrops.
 * @pure true
 */
export type GradientTransitionPath = {
  id: string;
  label: string;
  mood: string;
  gradients: readonly string[];
};
