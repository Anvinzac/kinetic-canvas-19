import { Check } from "lucide-react";
import type { GradientTransitionPath } from "@/features/canvas";

export function GradientPathButton({
  path,
  active,
  onClick,
}: {
  path: GradientTransitionPath;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left transition ${
        active ? "bg-white text-black" : "bg-white/[0.06] text-white hover:bg-white/[0.10]"
      }`}
    >
      <span className="flex h-12 w-24 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/15">
        {path.gradients.map((gradient, index) => (
          <span
            key={`${path.id}-${index}`}
            className="min-w-0 flex-1"
            style={{ background: gradient }}
            aria-hidden
          />
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black">{path.label}</span>
        <span
          className={`mt-0.5 block truncate font-mono text-[9px] uppercase tracking-[0.14em] ${
            active ? "text-black/55" : "text-white/55"
          }`}
        >
          {path.mood}
        </span>
      </span>
      {active && <Check className="size-4 shrink-0" strokeWidth={3} />}
    </button>
  );
}
