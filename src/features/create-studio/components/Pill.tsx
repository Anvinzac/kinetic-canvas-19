/**
 * UI component: Pill.
 *
 * Exports: Pill
 * Depends on: react
 */

import type { ReactNode, ReactElement} from "react";

/**
 * Render the Pill UI.
 * @param props - Component props
 * @returns Rendered UI
 */
export function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-2 text-xs font-bold ${
        active ? "bg-white text-black" : "bg-white/10 text-white"
      }`}
    >
      {children}
    </button>
  );
}
