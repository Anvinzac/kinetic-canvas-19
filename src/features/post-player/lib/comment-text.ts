/**
 * Comment chip labels, floating vs kinetic story paging, and flight timing.
 *
 * Exports: normalize/limit comment, float helpers, story pages/durations, getCommentLabel, CHIP_EXIT_PAD, MAX_COMMENT_*
 * Depends on: lib/canvas COMMENT_CHIPS, features/kinetic-text getWords, SAFE_CANVAS_BACKGROUND
 */

import { COMMENT_CHIPS, SAFE_CANVAS_BACKGROUND } from "@/lib/canvas";
import { getWords } from "@/features/kinetic-text";

export const FLOATING_COMMENT_MAX_WORDS = 3;
// Extra px a flying comment chip travels past each screen edge so it glides fully
// out of view before being hidden, instead of stopping at the edge (abrupt pop).
export const CHIP_EXIT_PAD = 56;
export const MAX_COMMENT_WORDS = 36;
export const MAX_COMMENT_CHARS = 240;
export const COMMENT_STORY_WORDS_PER_PAGE = 8;

const DEFAULT_CANVAS_BACKGROUND = SAFE_CANVAS_BACKGROUND;

export function normalizeComment(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function limitCommentText(value: string): string {
  const clipped = value.slice(0, MAX_COMMENT_CHARS);
  const words = getWords(clipped);
  if (words.length <= MAX_COMMENT_WORDS) return clipped;
  return words.slice(0, MAX_COMMENT_WORDS).join(" ");
}


export function getCommentFlightDuration(label: string): number {
  return Math.max(5600, Math.min(8400, 4300 + label.length * 55));
}

export function getFloatingCommentLabel(label: string): string {
  const words = getWords(label);
  if (words.length <= 10 && label.length <= 84) return label;
  const preview = words.slice(0, 10).join(" ");
  return `${preview}...`;
}


export function shouldFloatComment(label: string): boolean {
  return getCommentWordCount(label) <= FLOATING_COMMENT_MAX_WORDS;
}

export function getCommentWordCount(label: string): number {
  return label.match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu)?.length ?? 0;
}

export function getCommentStoryPages(text: string, fastMode: boolean): string[] {
  const normalized = normalizeComment(text);
  if (!normalized) return [""];
  if (fastMode) return [normalized];

  const words = getWords(normalized);
  if (words.length <= COMMENT_STORY_WORDS_PER_PAGE) return [normalized];

  const pages: string[] = [];
  for (let i = 0; i < words.length; i += COMMENT_STORY_WORDS_PER_PAGE) {
    pages.push(words.slice(i, i + COMMENT_STORY_WORDS_PER_PAGE).join(" "));
  }
  return pages;
}


export function getStoryPageDuration(text: string): number {
  const wordCount = getWords(text).length;
  return Math.max(2600, Math.min(5200, 1500 + wordCount * 360));
}


export function getFastStoryDuration(text: string): number {
  const wordCount = getWords(text).length;
  return Math.max(3200, Math.min(7600, 1700 + wordCount * 150));
}


export function getCommentStoryGradient(index: number): string {
  const gradients = [
    "linear-gradient(135deg,#FF006E,#8338EC)",
    "linear-gradient(135deg,#06FFA5,#118AB2)",
    "linear-gradient(135deg,#FFBE0B,#FB5607)",
    "linear-gradient(135deg,#3A86FF,#7209B7)",
    DEFAULT_CANVAS_BACKGROUND,
  ];
  return gradients[index % gradients.length];
}


export function getCommentLabel(chipId: string): string {
  const chip = COMMENT_CHIPS.find((item) => item.id === chipId);
  if (chip) return `${chip.emoji} ${chip.label}`;
  return normalizeComment(chipId.replace(/_/g, " ")) || "comment";
}

