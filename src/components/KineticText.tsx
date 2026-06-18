import { motion } from "framer-motion";
import type { CanvasSpec, Rhythm, Tempo } from "@/lib/canvas";

const tempoConfig: Record<Tempo, { duration: number; charDelay: number; loopSeconds: number }> = {
  slow: { duration: 1.05, charDelay: 0.075, loopSeconds: 3.4 },
  steady: { duration: 0.8, charDelay: 0.05, loopSeconds: 2.4 },
  snappy: { duration: 0.48, charDelay: 0.028, loopSeconds: 1.45 },
};

function entranceVariants(entrance: CanvasSpec["entrance"]) {
  switch (entrance) {
    case "fade":
      return { initial: { opacity: 0 }, animate: { opacity: 1 } };
    case "slide":
      return { initial: { opacity: 0, y: 60 }, animate: { opacity: 1, y: 0 } };
    case "scale":
      return { initial: { opacity: 0, scale: 0.3 }, animate: { opacity: 1, scale: 1 } };
    case "blur":
      return {
        initial: { opacity: 0, filter: "blur(24px)" },
        animate: { opacity: 1, filter: "blur(0px)" },
      };
    case "split":
      return { initial: { opacity: 0, letterSpacing: "0.5em" }, animate: { opacity: 1 } };
  }
}

export function KineticText({
  spec,
  playKey = 0,
  paused = false,
}: {
  spec: CanvasSpec;
  playKey?: number;
  paused?: boolean;
}) {
  const v = entranceVariants(spec.entrance);
  const isSplit = spec.entrance === "split";
  const chars = spec.text.split("");
  const tempo = tempoConfig[spec.tempo];

  return (
    <div
      className="absolute pointer-events-none select-none"
      style={{
        left: `${spec.x}%`,
        top: `${spec.y}%`,
        transform: "translate(-50%, -50%)",
        maxWidth: "92%",
      }}
    >
      <motion.div
        key={playKey}
        initial={v.initial}
        animate={v.animate}
        transition={{ duration: tempo.duration, ease: [0.22, 1, 0.36, 1] }}
        style={{
          fontFamily: spec.font,
          fontSize: spec.size,
          color: spec.color,
          fontWeight: spec.weight,
          letterSpacing: `${spec.letterSpacing}em`,
          transform: `rotate(${spec.rotation}deg)`,
          lineHeight: 0.95,
          textAlign: "center",
          textShadow: "0 4px 40px rgba(0,0,0,0.45)",
          animation: getLoopAnimation(spec.loop, spec.tempo),
          animationPlayState: paused ? "paused" : "running",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {isSplit
          ? chars.map((c, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: getRhythmDelay(i, spec.tempo, spec.rhythm),
                  duration: Math.max(0.28, tempo.duration * 0.62),
                }}
                style={{
                  display: "inline-block",
                  animationPlayState: paused ? "paused" : "running",
                }}
              >
                {c === " " ? "\u00A0" : c}
              </motion.span>
            ))
          : spec.text}
      </motion.div>
    </div>
  );
}

function getLoopAnimation(loop: CanvasSpec["loop"], tempo: Tempo) {
  if (loop === "none") return undefined;
  return `kinetic-${loop} ${tempoConfig[tempo].loopSeconds}s ease-in-out infinite`;
}

function getRhythmDelay(index: number, tempo: Tempo, rhythm: Rhythm) {
  const base = tempoConfig[tempo].charDelay;
  if (rhythm === "smooth") return index * base * 0.65;
  if (rhythm === "burst") return Math.min(index * base * 0.45, 0.32);
  return index * base;
}
