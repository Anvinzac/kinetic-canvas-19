import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { CanvasSpec, CanvasSticker } from "@/lib/canvas";

export function CanvasStickerLayer({
  stickers,
  text,
  layout,
  playKey = 0,
  compact = false,
}: {
  stickers?: CanvasSticker[];
  text: string;
  layout?: Pick<CanvasSpec, "x" | "y" | "size">;
  playKey?: string | number;
  compact?: boolean;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [wordAnchors, setWordAnchors] = useState<Record<string, Rect>>({});
  const visibleStickers = (stickers ?? []).filter((sticker) =>
    text.toLowerCase().includes(sticker.word.toLowerCase()),
  );

  useEffect(() => {
    const layer = layerRef.current;
    const canvas = layer?.parentElement;
    if (!layer || !canvas || visibleStickers.length === 0) {
      setWordAnchors({});
      return;
    }

    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      const canvasRect = canvas.getBoundingClientRect();
      if (!canvasRect.width || !canvasRect.height) return;

      const next: Record<string, Rect> = {};
      const anchorNodes = canvas.querySelectorAll<HTMLElement>("[data-kinetic-word]");
      anchorNodes.forEach((node) => {
        const key = node.dataset.kineticWord;
        if (!key || next[key]) return;
        const rect = node.getBoundingClientRect();
        next[key] = {
          left: ((rect.left - canvasRect.left) / canvasRect.width) * 100,
          right: ((rect.right - canvasRect.left) / canvasRect.width) * 100,
          top: ((rect.top - canvasRect.top) / canvasRect.height) * 100,
          bottom: ((rect.bottom - canvasRect.top) / canvasRect.height) * 100,
        };
      });
      setWordAnchors(next);
    };

    const frame = window.requestAnimationFrame(measure);
    const settleTimer = window.setTimeout(measure, 520);
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      observer.disconnect();
    };
  }, [playKey, text, visibleStickers.length]);

  if (visibleStickers.length === 0) return null;

  return (
    <div ref={layerRef} className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {visibleStickers.map((sticker, index) => {
        const anchor = wordAnchors[getWordAnchorKey(sticker.word)];
        const placement = anchor
          ? getWordAnchoredPlacement(sticker, anchor, compact)
          : getEmptySpacePlacement(sticker, index, text, layout, compact);
        return (
          <div
            key={`${sticker.id}-${playKey}`}
            className="absolute grid place-items-center"
            style={{
              left: `${placement.x}%`,
              top: `${placement.y}%`,
              width: `${placement.size}%`,
              aspectRatio: "1",
              translate: "-50% -50%",
            }}
          >
            <motion.div
              className="grid size-full place-items-center"
              initial={{ opacity: 0, scale: 0.72, rotate: -8 }}
              animate={{
                opacity: 1,
                scale: 1,
                rotate: index % 2 === 0 ? 3 : -3,
                y: compact ? [0, -3, 0] : [0, -8, 0],
              }}
              transition={{
                opacity: { duration: 0.22, delay: 0.35 + index * 0.08 },
                scale: {
                  type: "spring",
                  stiffness: 300,
                  damping: 20,
                  delay: 0.35 + index * 0.08,
                },
                rotate: { duration: 0.42, delay: 0.35 + index * 0.08 },
                y: {
                  duration: 2.8 + index * 0.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.55 + index * 0.1,
                },
              }}
            >
              {sticker.kind === "emoji" ? (
                <span
                  className="select-none text-center drop-shadow-[0_8px_22px_rgba(0,0,0,0.45)]"
                  style={{ fontSize: compact ? "1.65rem" : "clamp(2.8rem, 12vw, 5.4rem)" }}
                  aria-hidden
                >
                  {sticker.emoji}
                </span>
              ) : sticker.url ? (
                <img
                  src={sticker.url}
                  alt=""
                  className="size-full object-contain drop-shadow-[0_10px_26px_rgba(0,0,0,0.42)]"
                  loading="lazy"
                  draggable={false}
                />
              ) : null}
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}

function getWordAnchoredPlacement(
  sticker: CanvasSticker,
  anchor: Rect,
  compact: boolean,
): StickerPlacement {
  const desiredSize = compact ? Math.min(sticker.size, 12) : Math.min(sticker.size, 15);
  const rightRoom = Math.max(0, 96 - anchor.right);
  const topRoom = Math.max(0, anchor.top - 4);
  const fitByRight = rightRoom > 0 ? rightRoom / 0.74 : desiredSize;
  const fitByTop = topRoom > 0 ? topRoom / 0.42 : desiredSize;
  const size = clamp(compact ? 8 : 10, desiredSize, Math.min(desiredSize, fitByRight, fitByTop));
  const half = size / 2;

  return {
    x: clamp(half + 3, 100 - half - 3, anchor.right + size * 0.28),
    y: clamp(half + 3, 100 - half - 3, anchor.top - size * 0.2),
    size,
  };
}

type StickerPlacement = {
  x: number;
  y: number;
  size: number;
};

type Rect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

function getEmptySpacePlacement(
  sticker: CanvasSticker,
  index: number,
  text: string,
  layout: Pick<CanvasSpec, "x" | "y" | "size"> | undefined,
  compact: boolean,
): StickerPlacement {
  const size = compact ? Math.min(sticker.size, 14) : sticker.size;
  const avoidRect = getTextAvoidRect(text, layout, size);
  const seed = getStableNumber(`${sticker.word}-${index}`);
  const candidates = getStickerCandidates(compact, index);

  // Rule: emoji may only use composition gaps. First try candidate zones that
  // do not overlap the estimated typography block; if every zone is crowded,
  // choose the farthest candidate and keep it inside the safe canvas edge.
  return candidates
    .map((candidate, candidateIndex) => ({
      ...candidate,
      size,
      score:
        getCandidateDistanceScore(candidate, avoidRect) +
        (rectsOverlap(getStickerRect(candidate, size), avoidRect) ? -1000 : 0) +
        ((candidateIndex + seed) % candidates.length) * 0.01,
    }))
    .sort((a, b) => b.score - a.score)[0];
}

function getTextAvoidRect(
  text: string,
  layout: Pick<CanvasSpec, "x" | "y" | "size"> | undefined,
  stickerSize: number,
): Rect {
  const words = text.match(/\S+/g) ?? [];
  const longestWord = words.reduce((length, word) => Math.max(length, word.length), 0);
  const x = layout?.x ?? 50;
  const y = layout?.y ?? 50;
  const size = layout?.size ?? 76;
  const width = clamp(48, 84, Math.max(58, longestWord * 3.4 + Math.min(words.length, 9) * 3.2));
  const height = clamp(24, 64, Math.max(28, words.length * 6.2 + size * 0.16));
  const pad = stickerSize * 0.72 + 4;

  return {
    left: clamp(4, 96, x - width / 2 - pad),
    right: clamp(4, 96, x + width / 2 + pad),
    top: clamp(4, 96, y - height / 2 - pad),
    bottom: clamp(4, 96, y + height / 2 + pad),
  };
}

function getStickerCandidates(compact: boolean, index: number) {
  const inset = compact ? 17 : 18;
  const high = compact ? 24 : 20;
  const low = compact ? 76 : 80;
  const middle = compact ? 52 : 50;
  const candidates = [
    { x: inset, y: high },
    { x: 100 - inset, y: high },
    { x: inset, y: low },
    { x: 100 - inset, y: low },
    { x: 50, y: high - 3 },
    { x: inset - 2, y: middle },
    { x: 100 - inset + 2, y: middle },
    { x: 50, y: low + 1 },
  ];
  return [...candidates.slice(index % 2), ...candidates.slice(0, index % 2)];
}

function getCandidateDistanceScore(candidate: { x: number; y: number }, avoidRect: Rect) {
  const avoidX = (avoidRect.left + avoidRect.right) / 2;
  const avoidY = (avoidRect.top + avoidRect.bottom) / 2;
  const distance = Math.hypot(candidate.x - avoidX, (candidate.y - avoidY) * 1.15);
  const outsideX = candidate.x < avoidRect.left || candidate.x > avoidRect.right ? 16 : 0;
  const outsideY = candidate.y < avoidRect.top || candidate.y > avoidRect.bottom ? 16 : 0;
  return distance + outsideX + outsideY;
}

function getStickerRect(candidate: { x: number; y: number }, size: number): Rect {
  const radius = size / 2 + 3;
  return {
    left: candidate.x - radius,
    right: candidate.x + radius,
    top: candidate.y - radius,
    bottom: candidate.y + radius,
  };
}

function rectsOverlap(a: Rect, b: Rect) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function clamp(min: number, max: number, value: number) {
  return Math.min(max, Math.max(min, value));
}

function getStableNumber(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function getWordAnchorKey(word: string) {
  return word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "")
    .replace(/[^a-z0-9'-]/g, "");
}
