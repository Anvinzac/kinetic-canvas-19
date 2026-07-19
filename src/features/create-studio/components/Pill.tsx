import type { ReactNode } from "react";

export function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
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
