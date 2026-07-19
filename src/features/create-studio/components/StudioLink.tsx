/**
 * UI component: StudioLink.
 *
 * Exports: StudioLink
 * Depends on: react, lucide-react
 */

import type { ReactNode, ReactElement} from "react";
import { ChevronRight } from "lucide-react";

/**
 * Render the StudioLink UI.
 * @param props - Component props
 * @returns Rendered UI
 */
export function StudioLink({
  icon,
  label,
  value,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onClick: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 items-center gap-3 rounded-2xl bg-white/5 px-3 text-left ring-1 ring-white/10 transition hover:bg-white/10"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-black/25 text-white/80 [&_svg]:size-4">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-white">{label}</span>
        <span className="block truncate font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {value}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
