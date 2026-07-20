/**
 * Global date-range picker for admin sections (URL search params).
 *
 * Exports: DateRangeBar
 * Depends on: tanstack router Link navigate
 */

import { Link } from "@tanstack/react-router";
import type { AdminRangePreset } from "../lib/date-range";

const PRESETS: { id: AdminRangePreset; label: string }[] = [
  { id: "24h", label: "24h" },
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
];

type DateRangeBarProps = {
  preset: AdminRangePreset;
  from: string;
  to: string;
  basePath: string;
};

/**
 * Render preset range chips that write into search params.
 * @param props - current range + base path
 * @returns toolbar
 */
export function DateRangeBar(props: DateRangeBarProps): React.ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">Range</span>
      {PRESETS.map((p) => (
        <Link
          key={p.id}
          to={props.basePath}
          search={{ range: p.id, app: "kinetic-canvas" }}
          className={`rounded-md px-2.5 py-1 text-xs font-medium ${
            props.preset === p.id
              ? "bg-foreground text-background"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          {p.label}
        </Link>
      ))}
      <span className="text-xs text-muted-foreground">
        {props.from} → {props.to} (UTC)
      </span>
    </div>
  );
}
