/**
 * Shared helpers for building demo seed post canvas_html blobs.
 *
 * Exports: canvas, DEMO_TRANSITION_GRADIENTS, VOCAB_BOT_ID, NOVA_RAE_ID
 * Depends on: lib/canvas serializeCanvas
 */

import { serializeCanvas, TRANSITION_GRADIENT_PATHS, type CanvasSpec } from "@/features/canvas";

export const DEMO_TRANSITION_GRADIENTS = [
  ...(TRANSITION_GRADIENT_PATHS[0]?.gradients ?? [
    "linear-gradient(135deg,#FF006E,#8338EC)",
    "linear-gradient(135deg,#3A86FF,#06FFA5)",
    "linear-gradient(135deg,#FFBE0B,#FF006E)",
  ]),
];

export const VOCAB_BOT_ID = "77777777-7777-4777-8777-777777777777";
export const NOVA_RAE_ID = "22222222-2222-4222-8222-222222222222";

/**
 * canvas helper
 * @param overrides - overrides argument
 * @returns Boolean result
 */
export function canvas(overrides: Partial<CanvasSpec>): string {
  return serializeCanvas({
    text: "TYPE.",
    font: "Space Grotesk",
    size: 86,
    color: "#ffffff",
    weight: 900,
    letterSpacing: -0.03,
    x: 50,
    y: 50,
    entrance: "scale",
    loop: "pulse",
    tempo: "steady",
    rhythm: "stagger",
    rotation: 0,
    ...overrides,
  });
}
