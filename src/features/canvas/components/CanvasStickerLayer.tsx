/**
 * Overlay stickers anchored to kinetic words or empty composition gaps.
 *
 * Exports: CanvasStickerLayer
 * Depends on: framer-motion, canvas sticker-placement, kinetic-text getWordAnchorKey
 */

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { CanvasSpec, CanvasSticker } from "../types";
import { getWordAnchorKey } from "@/features/kinetic-text";
import {
  getEmptySpacePlacement,
  getWordAnchoredPlacement,
  type Rect,
} from "./sticker-placement";

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
