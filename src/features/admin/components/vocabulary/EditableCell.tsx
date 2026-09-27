/**
 * Tap-to-edit cell that auto-saves on blur / Enter.
 * Exports: EditableCell. Depends on: React.
 */

import { useEffect, useRef, useState } from "react";

type Props = {
  value: string;
  onSave: (next: string) => void;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
};

/**
 * Click-to-edit text cell. Saves on blur or Enter; cancels on Escape.
 * @param props.value current text
 * @param props.onSave called with trimmed value when user commits
 * @param props.multiline render a textarea instead of input
 * @returns editable cell UI
 */
export function EditableCell({ value, onSave, multiline, placeholder, className }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== value.trim()) onSave(trimmed);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    const shared = {
      ref: ref as React.RefObject<HTMLInputElement & HTMLTextAreaElement>,
      className: `w-full rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary/50 ${className ?? ""}`,
      value: draft,
      placeholder,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Escape") cancel();
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          commit();
        }
      },
    };
    return multiline ? <textarea rows={2} {...shared} /> : <input type="text" {...shared} />;
  }

  return (
    <button
      type="button"
      className={`cursor-text rounded px-2 py-1 text-left text-sm hover:bg-muted/60 transition-colors ${className ?? ""}`}
      onClick={() => setEditing(true)}
      aria-label={`Edit ${placeholder ?? "value"}`}
    >
      {value || <span className="text-muted-foreground italic">empty</span>}
    </button>
  );
}
