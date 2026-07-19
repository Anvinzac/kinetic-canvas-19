/**
 * Sticky create-studio header with back, title, and post action.
 *
 * Exports: StudioHeader
 * Depends on: lucide-react
 */

import { ChevronLeft, Send } from "lucide-react";
import type { ReactElement } from "react";

export type StudioHeaderProps = {
  title: string;
  subtitle: string;
  canPost: boolean;
  posting: boolean;
  isWritePage: boolean;
  onBack: () => void;
  onPublish: () => void;
};

/**
 * Render the sticky studio chrome header.
 * @param props - Title, publish gate, and navigation handlers
 * @returns Header element
 */
export function StudioHeader({
  title,
  subtitle,
  canPost,
  posting,
  isWritePage,
  onBack,
  onPublish,
}: StudioHeaderProps): ReactElement {
  return (
    <header className="sticky top-0 z-40 glass flex items-center justify-between border-b border-white/10 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3">
      <button
        onClick={onBack}
        className="-ml-1 grid size-9 place-items-center rounded-full bg-white/5 ring-1 ring-white/10"
        aria-label={isWritePage ? "Back" : "Back to writing"}
      >
        <ChevronLeft className="size-5" />
      </button>
      <div className="min-w-0 text-center">
        <h1 className="font-impact text-xl tracking-wider">{title}</h1>
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
          {subtitle}
        </p>
      </div>
      <button
        onClick={onPublish}
        disabled={!canPost}
        className="grad-aurora flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-white shadow-[var(--shadow-glow)] transition disabled:opacity-40"
      >
        <Send className="size-3.5" />
        {posting ? "posting" : "post"}
      </button>
    </header>
  );
}
