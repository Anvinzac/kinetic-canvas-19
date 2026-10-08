/**
 * Saved words as a drawer that slides in from the right edge, with the docked
 * handle that opens it.
 *
 * The handle is pulled, not pressed: a leftward drag from the right edge brings
 * the panel in, and a tap does the same. The dock carries `data-no-gesture` so a
 * pull never also drags the card underneath; the stream's own flick only reacts
 * to decisively VERTICAL swipes, so a leftward pull leaves it alone too.
 *
 * Opening does not navigate. The feed stays mounted behind the panel but is
 * suspended and stripped to the single on-screen word by its caller — see
 * VocabularyFeedPage.
 *
 * Exports: SavedDrawer, SAVED_DRAWER_EXIT_MS
 * Depends on: usePresence, useSavedCount, BookmarksPage, vocabulary.css
 */

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Bookmark } from "lucide-react";
import { usePresence } from "@/hooks/use-presence";
import { useSavedCount } from "../hooks/useSavedCount";
import { BookmarksPage } from "./BookmarksPage";

/** Matches the panel's exit keyframes in vocabulary.css. */
export const SAVED_DRAWER_EXIT_MS = 260;

/** Leftward travel, in px, that counts as a complete pull. */
const PULL_DISTANCE = 92;
/** Fraction of that travel which commits instead of springing back. */
const PULL_COMMIT = 0.55;
/** Movement before a touch is treated as a drag rather than a tap. */
const DRAG_SLOP = 6;

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

  // A half-finished gesture must not outlive the component.
  useEffect(() => () => detach.current?.(), []);

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
      applyPull(Math.max(0, Math.min(1, -dx / PULL_DISTANCE)));
    };

    const onUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== event.pointerId) return;
      const from = start.current;
      start.current = null;
      const committed = Boolean(from) && dragging.current && pullRef.current >= PULL_COMMIT;
      suppressClick.current = dragging.current;
      dragging.current = false;
      applyPull(0);
      detach.current?.();
      if (committed) onOpenChange(true);
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

  return (
    <>
      <div
        className="vocab-saved-dock"
        data-no-gesture
        data-pulling={pull > 0 || undefined}
        data-hidden={open || undefined}
        style={{ "--pull": pull } as React.CSSProperties}
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
          <span className="vocab-saved-grip" aria-hidden="true" />
          <Bookmark size={13} fill={savedCount ? "currentColor" : "none"} aria-hidden="true" />
          {savedCount > 0 && (
            <span className="vocab-saved-handle-count" aria-hidden="true">
              {savedCount > 99 ? "99+" : savedCount}
            </span>
          )}
        </button>
      </div>

      {presence.mounted && (
        <>
          <div
            className="vocab-saved-scrim"
            data-closing={presence.closing || undefined}
            aria-hidden="true"
            onClick={() => onOpenChange(false)}
          />
          <aside
            className="vocab-saved-panel"
            data-closing={presence.closing || undefined}
            inert={presence.closing || undefined}
            role="dialog"
            aria-modal="true"
            aria-label="Từ vựng đã lưu"
          >
            <BookmarksPage onClose={() => onOpenChange(false)} />
          </aside>
        </>
      )}
    </>
  );
}
