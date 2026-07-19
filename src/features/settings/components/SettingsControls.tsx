/**
 * Shared row/control primitives for settings preference sections.
 *
 * Exports: Section, Row, PreferenceRow, ControlRow, SegmentedControl
 * Depends on: components/ui/switch, tanstack Link
 */

import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { Switch } from "@/components/ui/switch";

/**
 * Labeled settings group with divided rows.
 * @param props.title - Section heading (uppercase mono)
 * @param props.children - Row / PreferenceRow / ControlRow children
 * @returns Section wrapper
 */
export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): ReactElement {
  return (
    <section>
      <h2 className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </h2>
      <div className="overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10 divide-y divide-white/5">
        {children}
      </div>
    </section>
  );
}

/**
 * Navigational or action row with trailing chevron.
 * @param props - Icon, label, optional value, and either `to` or `onClick`
 * @returns Link or button row
 */
export function Row({
  icon,
  label,
  value,
  to,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value?: ReactNode;
  to?: string;
  onClick?: () => void;
}): ReactElement {
  const content = (
    <>
      <IconSlot>{icon}</IconSlot>
      <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
      {value && (
        <span className="max-w-[42%] truncate font-mono text-xs text-muted-foreground">
          {value}
        </span>
      )}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
    </>
  );
  const cls = "flex items-center gap-3 px-3.5 py-3 transition hover:bg-white/5";
  if (to)
    return (
      <Link to={to} className={cls}>
        {content}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className={`${cls} w-full text-left`}>
      {content}
    </button>
  );
}

/**
 * Toggle row backed by the shared Switch control.
 * @param props - Icon, label, checked state, and change handler
 * @returns Preference toggle row
 */
export function PreferenceRow({
  icon,
  label,
  checked,
  onCheckedChange,
}: {
  icon: ReactNode;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}): ReactElement {
  return (
    <div className="flex items-center gap-3 px-3.5 py-3">
      <IconSlot>{icon}</IconSlot>
      <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </div>
  );
}

/**
 * Row that hosts a custom control (e.g. segmented) under the label.
 * @param props - Icon, label, and control children
 * @returns Control layout row
 */
export function ControlRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div className="px-3.5 py-3">
      <div className="mb-3 flex items-center gap-3">
        <IconSlot>{icon}</IconSlot>
        <span className="text-sm">{label}</span>
      </div>
      {children}
    </div>
  );
}

function IconSlot({ children }: { children: ReactNode }): ReactElement {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/5 text-muted-foreground [&_svg]:size-4">
      {children}
    </span>
  );
}

/**
 * Three-way (or N-way) segmented picker used for audience / format.
 * @param props.value - Currently selected option value
 * @param props.options - Value/label/(optional icon) entries
 * @param props.onChange - Called with the new option value
 * @returns Segmented button group
 */
export function SegmentedControl({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string; icon?: ReactNode }[];
  onChange: (value: string) => void;
}): ReactElement {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl bg-black/20 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-bold transition ${
            value === option.value
              ? "bg-white text-black"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {option.icon}
          <span className="truncate">{option.label}</span>
        </button>
      ))}
    </div>
  );
}
