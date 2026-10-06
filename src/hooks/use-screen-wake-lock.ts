/**
 * Screen wake lock for the immersive kinetic scenes.
 *
 * The feed is DOM animation driven by an `<audio>` element, not a `<video>`, so nothing
 * signals "media is playing" to the OS and the screen dims/locks mid-view. This holds a
 * `screen` wake lock while an immersive scene is the active, visible thing.
 *
 * IMPORTANT — secure context only: the Screen Wake Lock API is exposed solely on
 * `https://` and `http://localhost`. Over a plain-HTTP LAN origin (e.g. testing on a
 * phone via `http://192.168.x.x:8081`) `navigator.wakeLock` is `undefined` and this is a
 * silent no-op; use HTTPS (or localhost) to exercise it on a device.
 *
 * Graceful degradation: unsupported browsers (e.g. Firefox, Safari < 16.4) simply get no
 * lock — nothing throws and behaviour is unchanged. The lock is auto-released by the
 * browser when the tab is hidden, so we re-request on `visibilitychange` → visible.
 *
 * Exports: useScreenWakeLock, SCREEN_WAKE_LOCK_ENABLED
 * Depends on: react
 */
import { useEffect } from "react";

/** Master switch. Set to `false` to stop requesting the wake lock everywhere. */
export const SCREEN_WAKE_LOCK_ENABLED = true;

/**
 * Hold a screen wake lock while `active`.
 * @param active whether the caller's immersive scene is on screen and should stay lit
 *   (callers typically pass `!orientationGated`, and may also gate on playback).
 */
export function useScreenWakeLock(active: boolean): void {
  useEffect(() => {
    if (!SCREEN_WAKE_LOCK_ENABLED || !active) return;
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      // Requesting while hidden throws; the visibilitychange listener retries on return.
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        sentinel = await navigator.wakeLock.request("screen");
      } catch {
        // NotAllowedError (hidden, or user/OS denied) — nothing to do; we retry on visible.
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void request();
    };

    void request();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, [active]);
}
