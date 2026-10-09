/**
 * Rotation-gate configuration.
 *
 * The gate shows a "rotate to portrait" overlay on phones held in landscape, because
 * every kinetic scene (vocabulary feed, post player) is authored portrait-first. It is
 * deliberately easy to switch off:
 *   - Flip `ORIENTATION_GATE_ENABLED` to `false` to remove the gate everywhere at once.
 *   - Or, per device and without a rebuild, run in the console:
 *       localStorage.setItem("kinetic.orientation.gate", "off")   // disable
 *       localStorage.setItem("kinetic.orientation.gate", "on")    // re-enable
 *     The master constant always wins: when it is `false`, no override can turn the
 *     gate back on.
 *
 * Exports: ORIENTATION_GATE_ENABLED, ORIENTATION_GATE_STORAGE_KEY, ORIENTATION_GATE_EVENT,
 *          readOrientationGateEnabled, setOrientationGateEnabled
 * Depends on: none (SSR-safe)
 */

/**
 * Master switch. Set to `false` to disable the rotation gate across the whole app.
 * This is the single line to change once the cross-browser trial is finished.
 *
 * !!! TEMPORARILY OFF FOR LANDSCAPE TESTING — RESTORE TO `true` BEFORE DEPLOYING. !!!
 * Landscape layout work is in progress (empty-vault scene, bottom chrome band), and
 * the gate hides the very screens being worked on. Flip this back before the next
 * push to the cloud.
 */
export const ORIENTATION_GATE_ENABLED = false;

/** `localStorage` key for the per-device runtime override ("on" | "off"). */
export const ORIENTATION_GATE_STORAGE_KEY = "kinetic.orientation.gate";

/** Same-tab signal fired after a runtime override is written (native `storage` skips us). */
export const ORIENTATION_GATE_EVENT = "kinetic:orientation-gate";

/**
 * Whether the gate is active for this context. The master constant is authoritative;
 * when it is on, a stored per-device override may still turn it off (or explicitly on).
 * SSR-safe: returns `false` when there is no `window`.
 */
export function readOrientationGateEnabled(): boolean {
  if (!ORIENTATION_GATE_ENABLED) return false; // master off wins over any override
  if (typeof window === "undefined") return false;
  try {
    const override = window.localStorage.getItem(ORIENTATION_GATE_STORAGE_KEY);
    if (override === "off") return false;
    if (override === "on") return true;
  } catch {
    // quota / privacy mode — fall back to the compiled default
  }
  return ORIENTATION_GATE_ENABLED;
}

/**
 * Write a per-device runtime override and notify same-tab listeners. Intended for the
 * cross-browser trial (toggle from devtools without redeploying); pass `null` to clear
 * the override and fall back to the master constant.
 */
export function setOrientationGateEnabled(on: boolean | null): void {
  if (typeof window === "undefined") return;
  try {
    if (on === null) window.localStorage.removeItem(ORIENTATION_GATE_STORAGE_KEY);
    else window.localStorage.setItem(ORIENTATION_GATE_STORAGE_KEY, on ? "on" : "off");
  } catch {
    // Ignore storage failures; still broadcast so the UI reflects the intent.
  }
  window.dispatchEvent(new Event(ORIENTATION_GATE_EVENT));
}
