/**
 * UI component: SliderRow.
 *
 * Exports: SliderRow
 * Depends on: none (leaf module)
 */

import type { ReactElement } from "react";
/**
 * Render the SliderRow UI.
 * @param props - Component props
 * @returns Rendered UI
 */
export function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}): ReactElement {
  return (
    <div>
      <div className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-widest text-white/55">
        <span>{label}</span>
        <span>{value.toFixed(step < 1 ? 2 : 0)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-[var(--color-magenta)]"
      />
    </div>
  );
}
