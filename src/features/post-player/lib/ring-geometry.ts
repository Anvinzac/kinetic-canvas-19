/**
 * Corner-dock ring geometry for post action buttons.
 *
 * Exports: RING_* constants, ringButtonOffset, ARC_BUTTON_TAP*
 * Depends on: none
 */

export const ARC_BUTTON_TAP = { scale: 0.94, y: 2 };
export const ARC_BUTTON_TAP_TRANSITION = { type: "spring" as const, stiffness: 400, damping: 24 };
/** Show the comment action as the small hub inside the corner dock. */
export const SHOW_CORNER_COMMENT_ACTION = true;
/** A compact cropped corner dock. The comment hub owns the inner half of the radius; the three subtle action cells sit on the outer half. */
export const RING_HUB = 24;
export const RING_OUTER = 94;
export const RING_HUB_RADIUS = 47;
export const RING_RADIUS = 70;
export const RING_DIVIDER_INSET = RING_HUB_RADIUS;
export const RING_BTN_HALF = 20; // half of size-10 (40px) action buttons
export const RING_BUTTON_ANGLES = [4, 45, 86];
export const RING_DIVIDER_ANGLES = [23.5, 66.5];

/**
 * Compute absolute right/bottom offsets for a ring action button.
 * @param angleDeg - angleDeg argument
 * @returns Function result
 */
export function ringButtonOffset(angleDeg: number): { right: number; bottom: number } {
  const a = (angleDeg * Math.PI) / 180;
  return {
    right: Math.round(RING_HUB + RING_RADIUS * Math.sin(a) - RING_BTN_HALF),
    bottom: Math.round(RING_HUB + RING_RADIUS * Math.cos(a) - RING_BTN_HALF),
  };
}
