/**
 * Phone-in-landscape detection for the rotation gate.
 *
 * Returns `true` only when the gate is enabled AND the device is a touch screen held in
 * landscape AND the viewport is short enough to be a phone (a tablet or desktop in
 * landscape is taller and is intentionally left alone). Built for the widest possible
 * browser support, since the point of the gate is a cross-device trial:
 *   - re-evaluates on `resize` and `orientationchange` as well as `matchMedia` changes,
 *     so browsers without MediaQueryList change events still update;
 *   - subscribes with the legacy `addListener` API when `addEventListener` is absent
 *     (old iOS Safari);
 *   - detects touch via `pointer: coarse` OR `navigator.maxTouchPoints` OR `ontouchstart`,
 *     so an unsupported `pointer` media feature cannot silently disable the gate.
 *
 * Exports: useOrientationGate
 * Depends on: @/lib/orientation-gate
 */
import { useEffect, useState } from "react";
import {
  ORIENTATION_GATE_EVENT,
  ORIENTATION_GATE_STORAGE_KEY,
  readOrientationGateEnabled,
} from "@/lib/orientation-gate";

/** A landscape phone is short; tablets and desktops in landscape are taller than this. */
const SHORT_LANDSCAPE_MAX_HEIGHT_PX = 500;

function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(pointer: coarse)").matches) return true;
  if ((navigator.maxTouchPoints ?? 0) > 0) return true;
  return "ontouchstart" in window;
}

/** Subscribe to a MediaQueryList, falling back to the deprecated API on old Safari. */
function subscribeMedia(mq: MediaQueryList, handler: () => void): () => void {
  if (typeof mq.addEventListener === "function") {
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }
  mq.addListener(handler);
  return () => mq.removeListener(handler);
}

/**
 * Whether the rotate-to-portrait overlay should be showing right now.
 * @returns `true` on an enabled touch phone held in landscape; `false` otherwise.
 */
export function useOrientationGate(): boolean {
  // Start hidden so server render and first client paint agree (no hydration mismatch).
  const [show, setShow] = useState(false);

  useEffect(() => {
    const landscape = window.matchMedia("(orientation: landscape)");
    const short = window.matchMedia(`(max-height: ${SHORT_LANDSCAPE_MAX_HEIGHT_PX}px)`);

    const evaluate = () => {
      if (!readOrientationGateEnabled()) {
        setShow(false);
        return;
      }
      setShow(landscape.matches && short.matches && isTouchDevice());
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === ORIENTATION_GATE_STORAGE_KEY) evaluate();
    };

    evaluate();

    const offLandscape = subscribeMedia(landscape, evaluate);
    const offShort = subscribeMedia(short, evaluate);
    window.addEventListener("resize", evaluate);
    window.addEventListener("orientationchange", evaluate);
    window.addEventListener(ORIENTATION_GATE_EVENT, evaluate);
    window.addEventListener("storage", onStorage);

    return () => {
      offLandscape();
      offShort();
      window.removeEventListener("resize", evaluate);
      window.removeEventListener("orientationchange", evaluate);
      window.removeEventListener(ORIENTATION_GATE_EVENT, evaluate);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return show;
}
