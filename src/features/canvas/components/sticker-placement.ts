/**
 * Sticker placement math — word-anchored and empty-space candidates.
 *
 * Exports: getWordAnchoredPlacement, getEmptySpacePlacement, Rect helpers
 * Depends on: canvas types
 */

import type { CanvasSpec, CanvasSticker } from "../types";

export type StickerPlacement = {
  x: number;
  y: number;
  size: number;
};

export type Rect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export function getWordAnchoredPlacement(
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

export function getEmptySpacePlacement(
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
