import { motion } from "framer-motion";
import type { CanvasSpec } from "@/lib/canvas";

const loopAnim: Record<string, string | undefined> = {
  pulse: "kinetic-pulse 2.4s ease-in-out infinite",
  float: "kinetic-float 3.2s ease-in-out infinite",
  shake: "kinetic-shake 0.4s ease-in-out infinite",
  none: undefined,
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
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
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
          animation: loopAnim[spec.loop],
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
                transition={{ delay: i * 0.05, duration: 0.5 }}
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
