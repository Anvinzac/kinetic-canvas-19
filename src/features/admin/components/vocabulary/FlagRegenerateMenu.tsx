/**
 * Three-dot flag menu for a generated-content cell: pick what's wrong with
 * predefined complaint chips, then ask Claude to rewrite the phrase.
 *
 * Exports: FlagRegenerateMenu. Depends on: React, lucide-react.
 */

import { useEffect, useRef, useState } from "react";
import { MoreVertical, Sparkles, Loader2 } from "lucide-react";

const COMPLAINTS = [
  "too long",
  "redundant word",
  "vague",
  "not natural Vietnamese",
  "circular definition",
  "contains English",
  "wrong tone",
] as const;

type Props = {
  /** Invoked with the selected complaints; resolves when the new value is applied. */
  onRegenerate: (complaints: string[]) => Promise<unknown>;
  /** Label context for accessibility, e.g. "definition of resilient". */
  label: string;
};

/**
 * Small ⋮ button opening a dropdown of complaint chips + a regenerate action.
 * @returns the flag menu UI
 */
export function FlagRegenerateMenu({ onRegenerate, label }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (c: string) => {
    setError(null);
    setSelected((prev) => (prev.includes(c) ? prev.filter((p) => p !== c) : [...prev, c]));
  };

  const run = async () => {
    if (selected.length === 0) return;
    setPending(true);
    setError(null);
    try {
      await onRegenerate(selected);
      setOpen(false);
      setSelected([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Regeneration failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <div ref={rootRef} className="absolute bottom-0.5 right-0.5 z-20">
      <button
        type="button"
        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/60 hover:bg-muted hover:text-foreground transition-colors"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Flag issue with ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreVertical size={14} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-full right-0 mb-1 w-56 rounded-lg border border-border bg-background p-2 shadow-lg"
        >
          <p className="px-1 pb-1.5 text-xs font-medium text-muted-foreground">
            What's wrong?
          </p>
          <div className="flex flex-wrap gap-1">
            {COMPLAINTS.map((c) => (
              <button
                key={c}
                type="button"
                role="menuitemcheckbox"
                aria-checked={selected.includes(c)}
                className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                  selected.includes(c)
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
                onClick={() => toggle(c)}
              >
                {c}
              </button>
            ))}
          </div>

          {error && (
            <p className="mt-2 rounded bg-red-500/10 px-2 py-1 text-[11px] leading-snug text-red-500">
              {error}
            </p>
          )}

          <button
            type="button"
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground transition-opacity disabled:opacity-40"
            disabled={selected.length === 0 || pending}
            onClick={run}
          >
            {pending ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                Rewriting…
              </>
            ) : (
              <>
                <Sparkles size={13} />
                Regenerate with AI
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
