/**
 * Resolved and sliding post canvas backgrounds for page transitions.
 *
 * Exports: getResolvedPostBackground, getSlidingCanvasBackground, DEFAULT_CANVAS_BACKGROUND
 * Depends on: lib/canvas resolve/isUsable/isTooDark, Post type
 */

import {
  SAFE_CANVAS_BACKGROUND,
  isTooDarkCanvasBackground,
  isUsableCanvasBackground,
  resolveCanvasBackground,
  type CanvasSpec,
} from "@/lib/canvas";
import type { Post } from "../types";

export const DEFAULT_CANVAS_BACKGROUND = SAFE_CANVAS_BACKGROUND;

/**
 * Compute gradienttransitionpath.
 * @param spec - spec argument
 * @returns Computed value
 */
export function getGradientTransitionPath(spec: CanvasSpec): string[] {
  if (spec.backgroundStyle !== "transition") return [];
  return (spec.gradientPath ?? [])
    .map((gradient) => gradient.trim())
    .filter((gradient) => isUsableCanvasBackground(gradient));
}

/**
 * Compute resolvedpostbackground.
 * @param post - post argument
 * @returns Computed value
 */
export function getResolvedPostBackground(post: Post): string | null {
  return resolveCanvasBackground(post.bg_gradient, post.id);
}

/**
 * Compute slidingcanvasbackground.
 * @param spec - spec argument
 * @param fallback - fallback argument
 * @param shiftPage - shiftPage argument
 * @returns Computed value
 */
export function getSlidingCanvasBackground(
  spec: CanvasSpec,
  fallback: string | null,
  shiftPage: number,
): { background: string; width: string; x: string } | null {
  const colors = getTransitionColorCycle(spec, fallback);
  if (colors.length < 2) return null;

  const segmentCount = Math.max(64, colors.length * 12);
  const stripColors = Array.from(
    { length: segmentCount + 1 },
    (_, index) => colors[index % colors.length],
  );
  const stops = stripColors
    .map((color, index) => `${color} ${((index / segmentCount) * 100).toFixed(3)}%`)
    .join(", ");

  return {
    background: `linear-gradient(100deg, ${stops})`,
    width: `${segmentCount * 100}%`,
    x: `-${shiftPage * (100 / segmentCount)}%`,
  };
}

/**
 * Compute transitioncolorcycle.
 * @param spec - spec argument
 * @param fallback - fallback argument
 * @returns Computed value
 */
export function getTransitionColorCycle(spec: CanvasSpec, fallback: string | null): string[] {
  const gradients = getGradientTransitionPath(spec);
  const colors = gradients.reduce<string[]>((items, gradient, index) => {
    const stops = extractGradientColors(gradient).filter(
      (color) => !isTooDarkCanvasBackground(color),
    );
    if (stops.length < 2) return items;
    if (index === 0) items.push(stops[0]);
    items.push(stops[stops.length - 1]);
    return items;
  }, []);

  const fallbackStops = fallback
    ? extractGradientColors(fallback).filter((color) => !isTooDarkCanvasBackground(color)): [];
  const defaultStops = extractGradientColors(DEFAULT_CANVAS_BACKGROUND);
  const cycle =
    colors.length >= 2 ? colors : fallbackStops.length >= 2 ? fallbackStops : defaultStops;
  if (cycle.length < 2) return [];
  return cycle[0] === cycle[cycle.length - 1] ? cycle.slice(0, -1): cycle;
}

/**
 * extractGradientColors helper
 * @param value - value argument
 * @returns Computed value
 */
export function extractGradientColors(value: string): string[] {
  return (
    value.match(
      /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\)|color\([^)]*\)/g,
    ) ?? []
  );
}

