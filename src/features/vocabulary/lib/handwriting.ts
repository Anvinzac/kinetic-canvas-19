/** Sparse handwriting accents in the feed. Exports: pickHandwritingFont, HANDWRITING_MIN_GAP, HANDWRITING_MAX_GAP. Depends on: canvas HANDWRITING_FONTS, random. */
import { HANDWRITING_FONTS } from "@/features/canvas";
import { randomGenerator } from "./random";

/** Fewest words between two handwriting cards. */
export const HANDWRITING_MIN_GAP = 5;
/** Most words between two handwriting cards. */
export const HANDWRITING_MAX_GAP = 7;
/** Shuffles mint new stream keys; only the most recent few are worth keeping. */
const MAX_CACHED_STREAMS = 8;

type Schedule = {
  next: () => number;
  slots: number[];
  ordinal: Map<number, number>;
  offset: number;
};
const schedules = new Map<string, Schedule>();

function scheduleFor(streamKey: string): Schedule {
  let schedule = schedules.get(streamKey);
  if (schedule) return schedule;
  const random = randomGenerator(`${streamKey}:handwriting`);
  const span = HANDWRITING_MAX_GAP - HANDWRITING_MIN_GAP + 1;
  schedule = {
    next: () => HANDWRITING_MIN_GAP + Math.floor(random() * span),
    slots: [],
    ordinal: new Map(),
    offset: Math.floor(random() * HANDWRITING_FONTS.length),
  };
  if (schedules.size >= MAX_CACHED_STREAMS) schedules.delete(schedules.keys().next().value!);
  schedules.set(streamKey, schedule);
  return schedule;
}

/**
 * The handwriting face for a stream position, or null for an ordinary card. Slots are
 * spaced 5–7 positions apart (never the opening card) and walk through the faces in
 * turn, so consecutive accents never repeat a font. Deterministic per stream, so a
 * card keeps its face across re-renders, virtualisation and video export.
 * @param occurrenceId Stream occurrence id, `${streamKey}:${position}`
 * @param position Absolute position of the card in its stream
 * @returns A HANDWRITING_FONTS family or null
 */
export function pickHandwritingFont(occurrenceId: string, position: number): string | null {
  if (!Number.isFinite(position) || position < HANDWRITING_MIN_GAP) return null;
  const split = occurrenceId.lastIndexOf(":");
  const streamKey = split > 0 ? occurrenceId.slice(0, split) : occurrenceId;
  const schedule = scheduleFor(streamKey);
  while ((schedule.slots.at(-1) ?? 0) < position) {
    const slot = (schedule.slots.at(-1) ?? 0) + schedule.next();
    schedule.ordinal.set(slot, schedule.slots.length);
    schedule.slots.push(slot);
  }
  const index = schedule.ordinal.get(position);
  if (index === undefined) return null;
  return HANDWRITING_FONTS[(schedule.offset + index) % HANDWRITING_FONTS.length]!;
}
