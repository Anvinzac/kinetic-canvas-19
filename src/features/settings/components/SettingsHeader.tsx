/**
 * Sticky settings page header with back + reset actions.
 *
 * Exports: SettingsHeader
 * Depends on: lucide-react icons
 */

import { ChevronLeft, RefreshCw } from "lucide-react";
import type { ReactElement } from "react";

type SettingsHeaderProps = {
  onBack: () => void;
  onReset: () => void;
};

/**
 * Render the sticky SETTINGS title bar.
 * @param props.onBack - Navigate back (history or feed fallback)
 * @param props.onReset - Reset all preferences to defaults
 * @returns Sticky glass header element
 */
export function SettingsHeader({ onBack, onReset }: SettingsHeaderProps): ReactElement {
  return (
    <header className="sticky top-0 z-30 glass flex items-center justify-between border-b border-white/10 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="-ml-1 grid size-8 place-items-center"
          aria-label="Back"
        >
          <ChevronLeft className="size-5" />
        </button>
        <h1 className="font-impact text-2xl tracking-wider">SETTINGS</h1>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="grid size-9 place-items-center rounded-full bg-white/5 text-muted-foreground ring-1 ring-white/10 transition hover:text-foreground"
        aria-label="Reset settings"
      >
        <RefreshCw className="size-4" />
      </button>
    </header>
  );
}
