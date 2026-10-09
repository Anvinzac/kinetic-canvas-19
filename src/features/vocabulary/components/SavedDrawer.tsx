/**
 * Saved words as a drawer that slides in from the right edge, with the docked
 * handle that opens it.
 *
 * The handle is pulled, not pressed: a leftward drag from the right edge brings
 * the panel in, and a tap does the same. The handle is a tab welded to the panel's
 * leading edge, so it travels the exact same distance the edge sweeps in — the handle
 * and the drawer move together, one-for-one with the finger, never separating. A pull
 * that never commits slides the panel (and its tab) back out.
 * The dock carries `data-no-gesture` so a pull never also drags the card underneath;
 * the stream's own flick only reacts to decisively VERTICAL swipes, so a leftward pull
 * leaves it alone too.
 *
 * The panel covers ~85% of the width, leaving a strip of scrim on the far edge: a tap
 * there closes the drawer, and the exposed edge keeps a browser back-swipe from
 * starting on the panel itself.
 *
 * Opening does not navigate. The feed stays mounted behind the panel but is
 * suspended and stripped to the single on-screen word by its caller — see
 * VocabularyFeedPage.
 *
 * Exports: SavedDrawer, SAVED_DRAWER_EXIT_MS
 * Depends on: usePresence, useSavedCount, BookmarksPage, vocabulary.css
 */

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Bookmark, Heart } from "lucide-react";
import { usePresence } from "@/hooks/use-presence";
import { useSavedCount } from "../hooks/useSavedCount";
import { BookmarksPage } from "./BookmarksPage";

/** Matches the panel's exit duration in vocabulary.css and this module's retract timer. */
export const SAVED_DRAWER_EXIT_MS = 260;

/**
 * The drawer's own width, mirroring `min(420px, 85vw)` in vocabulary.css. The handle is a tab
 * welded to the panel's leading edge, so its travel is measured in the panel's width: pulling
 * moves the handle and the panel together, exactly as fast, so the two never separate.
 */
const PANEL_MAX_WIDTH = 420;
const PANEL_WIDTH_SHARE = 0.85;

/** Fraction of the pull which commits instead of springing back. */
const PULL_COMMIT = 0.55;
/** Movement before a touch is treated as a drag rather than a tap. */
const DRAG_SLOP = 6;
/** Symmetric ease so the drawer leaves the way it arrived, matching the stylesheet. */
const DRAWER_EASE = [0.65, 0, 0.35, 1] as const;

type SavedDrawerProps = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
};

/**
 * Right-edge handle plus the saved-words panel it pulls open.
 * @param props Open state and its change handler.
 * @returns The docked handle and, while open, the drawer.
 */
export function SavedDrawer({ open, onOpenChange }: SavedDrawerProps): React.ReactElement {
  const savedCount = useSavedCount();
  const presence = usePresence(open, SAVED_DRAWER_EXIT_MS);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const dragging = useRef(false);
  // Set when a drag ends, so the click that same gesture fires afterwards is
  // swallowed. One-shot: leaving it armed would eat the next ordinary tap.
  const suppressClick = useRef(false);
  // Mirrors `pull` for the pointerup handler, which would otherwise read the
  // value captured when the handler was created rather than the latest one.
  const pullRef = useRef(0);
  const [pull, setPull] = useState(0);
  const detach = useRef<(() => void) | null>(null);
  const handle = useRef<HTMLButtonElement>(null);
  // A released-but-uncommitted pull must animate the drawer back out, so it stays
  // mounted for the exit duration even though `open` never flipped true.
  const [retracting, setRetracting] = useState(false);
  const retractTimer = useRef<number | undefined>(undefined);
  const reduceMotion = useReducedMotion();
  // The panel's rendered width, mirroring `min(420px, 85vw)`, so the handle's travel is
  // measured against the real edge. 0 until the first measure (before mount nothing is
  // being dragged, so a zero travel is harmless).
  const [panelWidth, setPanelWidth] = useState(0);

  // A half-finished gesture must not outlive the component.
  useEffect(
    () => () => {
      detach.current?.();
      window.clearTimeout(retractTimer.current);
    },
    [],
  );

  // Track the drawer width across resizes/orientation so the handle stays welded to the
  // panel's leading edge on every viewport.
  useEffect(() => {
    const measure = () =>
      setPanelWidth(Math.min(PANEL_MAX_WIDTH, Math.round(window.innerWidth * PANEL_WIDTH_SHARE)));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const beginRetract = () => {
    setRetracting(true);
    window.clearTimeout(retractTimer.current);
    retractTimer.current = window.setTimeout(() => setRetracting(false), SAVED_DRAWER_EXIT_MS);
  };

  // Escape closes, and focus goes back to the handle that opened the drawer.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onOpenChange(false);
      handle.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    detach.current?.();
    start.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    dragging.current = false;
    suppressClick.current = false;
    // The panel's leading edge sweeps exactly its own width into view, so measuring the
    // pull in that width keeps the handle welded to the edge and makes the edge track
    // the finger one-for-one.
    const pullDistance = Math.max(1, panelWidth);

    const applyPull = (next: number) => {
      pullRef.current = next;
      setPull(next);
    };

    // Window listeners rather than setPointerCapture: capturing retargets the
    // follow-up `click` to the dock, which stopped a plain tap from ever
    // reaching the handle inside it.
    const onMove = (moveEvent: PointerEvent) => {
      const from = start.current;
      if (!from || moveEvent.pointerId !== from.id) return;
      const dx = moveEvent.clientX - from.x;
      const dy = moveEvent.clientY - from.y;
      if (!dragging.current) {
        if (Math.abs(dx) < DRAG_SLOP) return;
        // A mostly-vertical drag belongs to the page, not to the handle.
        if (Math.abs(dx) < Math.abs(dy)) {
          start.current = null;
          return;
        }
        dragging.current = true;
      }
      applyPull(Math.max(0, Math.min(1, -dx / pullDistance)));
    };

    const onUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== event.pointerId) return;
      const from = start.current;
      start.current = null;
      const committed = Boolean(from) && dragging.current && pullRef.current >= PULL_COMMIT;
      // The drawer rides out from the first pixel of a real drag, so anything beyond a
      // negligible movement has an on-screen edge to slide back out.
      const drawerWasShowing = dragging.current && pullRef.current > 0.02;
      suppressClick.current = dragging.current;
      dragging.current = false;
      applyPull(0);
      detach.current?.();
      if (committed) onOpenChange(true);
      else if (drawerWasShowing) beginRetract();
    };

    detach.current = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      detach.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const label = savedCount ? `Xem ${savedCount} từ đã lưu` : "Xem từ vựng đã lưu";

  // The handle is a tab welded to the panel's leading edge: it travels the SAME distance the
  // edge sweeps in (a fraction of the panel's width), so during a pull the two move as one.
  const drawerProgress = open ? 1 : Math.max(0, Math.min(1, pull));
  const drawerOffset = (1 - drawerProgress) * 100;
  const handleShift = drawerProgress * panelWidth;
  const draggingPanel = pull > 0 && !open;
  const showing = presence.mounted || pull > 0 || retracting;

  return (
    <>
      <div
        className="vocab-saved-dock"
        data-no-gesture
        data-pulling={pull > 0 || undefined}
        data-hidden={open || undefined}
        style={{ "--pull": pull, "--handle-shift": handleShift } as React.CSSProperties}
        onPointerDown={onPointerDown}
        onClickCapture={(event) => {
          if (!suppressClick.current) return;
          suppressClick.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <span className="vocab-saved-hint" aria-hidden="true">
          Đã lưu
        </span>
        <button
          ref={handle}
          type="button"
          className="vocab-saved-handle"
          aria-label={label}
          title={label}
          aria-expanded={open}
          onClick={() => onOpenChange(true)}
        >
          {/* The vault keeps two kinds, so the tab shows both: bookmark over heart,
              centred and spaced. The grip bar and the count badge are both gone — the tab
              names the drawer, it doesn't tally it or advertise a pull affordance. */}
          <Bookmark size={15} fill={savedCount ? "currentColor" : "none"} aria-hidden="true" />
          <Heart size={15} aria-hidden="true" />
        </button>
      </div>

      {showing && (
        <>
          {presence.mounted && (
            <div
              className="vocab-saved-scrim"
              data-closing={presence.closing || undefined}
              aria-hidden="true"
              onClick={() => onOpenChange(false)}
            />
          )}
          <motion.aside
            className="vocab-saved-panel"
            data-closing={presence.closing || undefined}
            data-dragging={draggingPanel || undefined}
            initial={{ x: "100%" }}
            animate={{ x: `${drawerOffset}%` }}
            transition={
              draggingPanel || reduceMotion
                ? { duration: 0 }
                : {
                    duration: (presence.closing || retracting ? SAVED_DRAWER_EXIT_MS : 320) / 1000,
                    ease: DRAWER_EASE,
                  }
            }
            inert={presence.closing || draggingPanel || undefined}
            role="dialog"
            aria-modal="true"
            aria-label="Từ vựng đã lưu"
          >
            <BookmarksPage onClose={() => onOpenChange(false)} />
          </motion.aside>
        </>
      )}
    </>
  );
}
