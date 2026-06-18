import { motion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CanvasSpec, Rhythm, Tempo } from "@/lib/canvas";

const FULL_CANVAS_MAX_HEIGHT = 764;
const CANVAS_RATIO = 16 / 9;
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const tempoConfig: Record<Tempo, { duration: number; wordDelay: number; loopSeconds: number }> = {
  slow: { duration: 1.05, wordDelay: 0.2, loopSeconds: 3.4 },
  steady: { duration: 0.8, wordDelay: 0.14, loopSeconds: 2.4 },
  snappy: { duration: 0.48, wordDelay: 0.08, loopSeconds: 1.45 },
};

function entranceVariants(entrance: CanvasSpec["entrance"]) {
  switch (entrance) {
    case "fade":
      return { initial: { opacity: 0 }, animate: { opacity: 1 } };
    case "slide":
      return { initial: { opacity: 0, y: 40 }, animate: { opacity: 1, y: 0 } };
    case "scale":
      return { initial: { opacity: 0, scale: 0.3 }, animate: { opacity: 1, scale: 1 } };
    case "blur":
      return {
        initial: { opacity: 0, filter: "blur(24px)" },
        animate: { opacity: 1, filter: "blur(0px)" },
      };
    case "split":
      return { initial: { opacity: 0, y: 40 }, animate: { opacity: 1, y: 0 } };
  }
}

export function KineticText({
  spec,
  playKey = 0,
  paused = false,
  scaleToCanvas = false,
}: {
  spec: CanvasSpec;
  playKey?: number;
  paused?: boolean;
  scaleToCanvas?: boolean;
}) {
  const wordVariants = entranceVariants(spec.entrance);
  const words = getWords(spec.text);
  const tempo = tempoConfig[spec.tempo];
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [canvasScale, setCanvasScale] = useState(scaleToCanvas ? 0.4 : 1);
  const [fitScale, setFitScale] = useState(1);
  const previewSize = Math.max(10, spec.size * canvasScale * fitScale);

  useEffect(() => {
    if (!scaleToCanvas) {
      setCanvasScale(1);
      return;
    }

    const wrapper = wrapperRef.current;
    const canvas = wrapper?.parentElement;
    if (!canvas) return;

    function measure() {
      const previewHeight = canvas?.getBoundingClientRect().height ?? 0;
      if (!previewHeight) return;
      setCanvasScale(clamp(previewHeight / getFullCanvasHeight(), 0.2, 1));
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [scaleToCanvas]);

  useEffect(() => {
    setFitScale(1);
  }, [
    canvasScale,
    spec.text,
    spec.size,
    spec.font,
    spec.weight,
    spec.letterSpacing,
    spec.entrance,
    spec.x,
    spec.y,
  ]);

  useIsomorphicLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const text = textRef.current;
    const canvas = wrapper?.parentElement;
    if (!wrapper || !text || !canvas) return;

    const canvasHeight = canvas.getBoundingClientRect().height;
    const wrapperWidth = wrapper.getBoundingClientRect().width;
    if (!canvasHeight || !wrapperWidth) return;

    const verticalRoom = (canvasHeight * Math.min(spec.y, 100 - spec.y) * 2) / 100;
    const maxHeight = Math.max(canvasHeight * 0.3, verticalRoom * 0.9);
    const widthRatio = wrapperWidth / Math.max(text.scrollWidth, 1);
    const heightRatio = maxHeight / Math.max(text.scrollHeight, 1);
    const nextFit = Math.min(1, fitScale * Math.min(widthRatio, heightRatio) * 0.98);

    if (nextFit < fitScale - 0.01) {
      setFitScale(Math.max(0.16, nextFit));
    }
  }, [
    fitScale,
    previewSize,
    spec.text,
    spec.font,
    spec.weight,
    spec.letterSpacing,
    spec.entrance,
    spec.y,
  ]);

  return (
    <div
      ref={wrapperRef}
      className="absolute pointer-events-none select-none"
      style={{
        left: `${spec.x}%`,
        top: `${spec.y}%`,
        transform: "translate(-50%, -50%)",
        width: "86%",
        maxWidth: "86%",
      }}
    >
      <motion.div
        ref={textRef}
        key={playKey}
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        style={{
          fontFamily: spec.font,
          fontSize: previewSize,
          color: spec.color,
          fontWeight: spec.weight,
          letterSpacing: `${spec.letterSpacing}em`,
          transform: `rotate(${spec.rotation}deg)`,
          lineHeight: 0.95,
          textAlign: "center",
          textShadow: "0 4px 40px rgba(0,0,0,0.45)",
          animation: getLoopAnimation(spec.loop, spec.tempo),
          animationPlayState: paused ? "paused" : "running",
          whiteSpace: "normal",
          wordBreak: "normal",
          overflowWrap: "break-word",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "center",
          columnGap: "0.24em",
          rowGap: "0.1em",
        }}
      >
        {words.map((word, i) => (
          <motion.span
            key={`${playKey}-${word}-${i}`}
            initial={wordVariants.initial}
            animate={wordVariants.animate}
            transition={{
              delay: getRhythmDelay(i, spec.tempo, spec.rhythm),
              duration: Math.max(0.28, tempo.duration * 0.62),
              ease: [0.22, 1, 0.36, 1],
            }}
            style={{
              display: "inline-block",
              maxWidth: "100%",
              overflowWrap: "break-word",
              animationPlayState: paused ? "paused" : "running",
            }}
          >
            {word}
          </motion.span>
        ))}
      </motion.div>
    </div>
  );
}

function getLoopAnimation(loop: CanvasSpec["loop"], tempo: Tempo) {
  if (loop === "none") return undefined;
  return `kinetic-${loop} ${tempoConfig[tempo].loopSeconds}s ease-in-out infinite`;
}

function getRhythmDelay(index: number, tempo: Tempo, rhythm: Rhythm) {
  const base = tempoConfig[tempo].wordDelay;
  if (rhythm === "smooth") return index * base * 0.8;
  if (rhythm === "burst") return index * base * 0.7;
  return index * base;
}

function getWords(text: string) {
  return text.match(/\S+/g) ?? [];
}

function getFullCanvasHeight() {
  if (typeof window === "undefined") return FULL_CANVAS_MAX_HEIGHT;
  return Math.min(window.innerHeight, FULL_CANVAS_MAX_HEIGHT, window.innerWidth * CANVAS_RATIO);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
