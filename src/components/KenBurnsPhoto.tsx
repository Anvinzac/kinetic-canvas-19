import { useState, type CSSProperties } from "react";
import { motion, useReducedMotion, type Transition } from "framer-motion";
import { SAFE_CANVAS_BACKGROUND } from "@/lib/canvas";

type KenBurnsKeyframePreset = {
  scale: number[];
  x: string[];
  y: string[];
  duration: number;
  times?: number[];
};

const KEN_BURNS_PRESETS: KenBurnsKeyframePreset[] = [
  {
    scale: [1, 1.56, 1],
    x: ["0%", "15%", "0%"],
    y: ["0%", "-13%", "0%"],
    duration: 18,
  },
  {
    scale: [1, 1.52, 1.3, 1],
    x: ["0%", "-17%", "11%", "0%"],
    y: ["0%", "9%", "-12%", "0%"],
    duration: 24,
    times: [0, 0.42, 0.72, 1],
  },
  {
    scale: [1, 1.48, 1.58, 1.26, 1],
    x: ["0%", "12%", "-14%", "8%", "0%"],
    y: ["0%", "-8%", "14%", "-6%", "0%"],
    duration: 28,
    times: [0, 0.28, 0.52, 0.78, 1],
  },
  {
    scale: [1, 1.54, 1.34, 1],
    x: ["0%", "10%", "-15%", "0%"],
    y: ["0%", "15%", "-9%", "0%"],
    duration: 22,
    times: [0, 0.4, 0.7, 1],
  },
  {
    scale: [1, 1.5, 1.62, 1.22, 1],
    x: ["0%", "-14%", "6%", "-10%", "0%"],
    y: ["0%", "-11%", "12%", "7%", "0%"],
    duration: 26,
    times: [0, 0.32, 0.55, 0.8, 1],
  },
  {
    scale: [1, 1.46, 1],
    x: ["0%", "-16%", "0%"],
    y: ["0%", "13%", "0%"],
    duration: 16,
  },
  {
    scale: [1, 1.6, 1.38, 1],
    x: ["0%", "8%", "-13%", "0%"],
    y: ["0%", "-15%", "10%", "0%"],
    duration: 20,
    times: [0, 0.38, 0.68, 1],
  },
  {
    scale: [1, 1.53, 1.28, 1.44, 1],
    x: ["0%", "14%", "5%", "-12%", "0%"],
    y: ["0%", "7%", "-14%", "9%", "0%"],
    duration: 30,
    times: [0, 0.25, 0.5, 0.75, 1],
  },
];

const FULLSCREEN_REST = { scale: 1, x: "0%", y: "0%" } as const;
const PHOTO_CLASS = "absolute inset-0 size-full object-cover";

export function getKenBurnsPreset(seed: string) {
  let hash = 2166136261;
  const input = seed || "default";
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const presetIndex =
    ((hash % KEN_BURNS_PRESETS.length) + KEN_BURNS_PRESETS.length) % KEN_BURNS_PRESETS.length;
  return KEN_BURNS_PRESETS[presetIndex];
}

function getBackdropStyle(fallbackBackground?: string | null): CSSProperties {
  return {
    background: SAFE_CANVAS_BACKGROUND,
    backgroundImage: fallbackBackground ?? SAFE_CANVAS_BACKGROUND,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };
}

export function KenBurnsPhoto({
  src,
  seed,
  paused = false,
  fallbackBackground,
  className = PHOTO_CLASS,
}: {
  src: string;
  seed: string;
  paused?: boolean;
  fallbackBackground?: string | null;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();
  const [failed, setFailed] = useState(false);
  const preset = getKenBurnsPreset(seed);
  const staticMotion = reducedMotion || paused;
  const backdropStyle = getBackdropStyle(fallbackBackground);

  if (failed) return null;

  if (staticMotion) {
    return (
      <div className="absolute inset-0 overflow-hidden" style={backdropStyle} aria-hidden>
        <img
          src={src}
          alt=""
          className={className}
          draggable={false}
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  const transition: Transition = {
    duration: preset.duration,
    ease: "easeInOut",
    repeat: Infinity,
    ...(preset.times ? { times: preset.times } : {}),
  };

  return (
    <div className="absolute inset-0 overflow-hidden" style={backdropStyle} aria-hidden>
      <motion.img
        src={src}
        alt=""
        draggable={false}
        className={className}
        style={{ transformOrigin: "center center", willChange: "transform" }}
        initial={FULLSCREEN_REST}
        animate={{
          scale: preset.scale,
          x: preset.x,
          y: preset.y,
        }}
        transition={transition}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
