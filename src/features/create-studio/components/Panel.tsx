import type { ReactNode } from "react";

export function Panel({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        <span className="grid size-6 place-items-center rounded-lg bg-white/5 text-muted-foreground [&_svg]:size-3.5">
          {icon}
        </span>
        {title}
      </div>
      <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">{children}</div>
    </section>
  );
}
