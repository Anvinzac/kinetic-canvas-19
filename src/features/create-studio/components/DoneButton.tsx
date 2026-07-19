/**
 * UI component: DoneButton.
 *
 * Exports: DoneButton
 * Depends on: none (leaf module)
 */

import type { ReactElement } from "react";
/**
 * Render the DoneButton UI.
 * @param props - Component props
 * @returns Rendered UI
 */
export function DoneButton({ onClick }: { onClick: () => void }): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-black transition hover:bg-white/90"
    >
      done
    </button>
  );
}
