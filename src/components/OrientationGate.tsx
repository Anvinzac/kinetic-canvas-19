/**
 * Rotate-to-portrait overlay for the portrait-first kinetic scenes.
 *
 * Presentational: the caller decides visibility (usually via `useOrientationGate`) so the
 * same boolean can also suspend playback underneath. Rendered as a fixed, opaque,
 * top-most layer that covers the whole viewport and captures touch, so a landscape phone
 * cannot interact with the mis-fitting scene behind it.
 *
 * Exports: OrientationGate
 * Depends on: none
 */
import type { ReactElement } from "react";

interface OrientationGateProps {
  /** When true, the overlay is shown; when false it renders nothing. */
  show: boolean;
}

/** Full-screen "please rotate to portrait" prompt. @returns The overlay, or null. */
export function OrientationGate({ show }: OrientationGateProps): ReactElement | null {
  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-[10000] flex flex-col items-center justify-center gap-5 bg-[#0a0014] px-10 text-center text-white"
      role="alertdialog"
      aria-modal="true"
      aria-label="Mình xoay điện thoại lại giúp nha"
    >
      <svg
        className="h-16 w-16 animate-pulse text-white/80"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Phone body tilting from landscape back to portrait, with a rotate arrow. */}
        <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
        <path d="M11 18.5h2" />
        <path d="M3.5 9a8.5 8.5 0 0 1 3-4.5" />
        <path d="M3 3.5V7h3.5" />
      </svg>
      <div className="flex flex-col gap-1.5">
        <p className="text-lg font-semibold tracking-tight">Hông được bạn ơi</p>
        <p className="text-sm text-white/60">Màn ngang bị hẹp, không đảm bảo trải nghiệm được í</p>
      </div>
    </div>
  );
}
