/**
 * Admin template manager — CRUD for canvas templates backed by local JSON.
 *
 * Exports: TemplateManagerPage
 * Depends on: @tanstack/react-query, template.functions, queries
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { adminTemplatesQueryOptions } from "../../api/queries";
import {
  addTemplateItem,
  deleteTemplateItem,
  updateTemplateSection,
  type TemplateData,
  type TemplateSection,
} from "../../api/template.functions";

const TABS: { key: TemplateSection; label: string }[] = [
  { key: "gradients", label: "Gradients" },
  { key: "transitionPaths", label: "Transitions" },
  { key: "patterns", label: "Patterns" },
  { key: "scenes", label: "Scenes" },
  { key: "animationTemplates", label: "Templates" },
  { key: "photos", label: "Photos" },
  { key: "videos", label: "Videos" },
  { key: "fonts", label: "Fonts" },
  { key: "entrances", label: "Motion" },
  { key: "palette", label: "Palette" },
  { key: "commentChips", label: "Chips" },
];

function getItemId(item: unknown): string {
  if (item != null && typeof item === "object" && "id" in item) return (item as { id: string }).id;
  return String(item);
}

function getItemLabel(item: unknown): string {
  if (item != null && typeof item === "object") {
    const o = item as Record<string, unknown>;
    return (o.label ?? o.id ?? o.emoji ?? String(item)) as string;
  }
  return String(item);
}

// ---------------------------------------------------------------------------
// Visual previews
// ---------------------------------------------------------------------------

function Preview({ section, item }: { section: TemplateSection; item: unknown }) {
  if (section === "gradients" && typeof item === "string") {
    return <div className="h-16 w-full rounded-md" style={{ background: item }} />;
  }
  if (section === "transitionPaths" && typeof item === "object" && item !== null) {
    const t = item as { gradients: string[] };
    return (
      <div className="flex h-16 w-full overflow-hidden rounded-md">
        {t.gradients.map((g, i) => (
          <div key={i} className="flex-1" style={{ background: g }} />
        ))}
      </div>
    );
  }
  if ((section === "patterns" || section === "scenes") && typeof item === "object" && item !== null) {
    const t = item as { base: string; image: string; size?: string | null };
    return (
      <div
        className="h-24 w-full rounded-md"
        style={{
          backgroundColor: t.base,
          backgroundImage: t.image,
          backgroundSize: t.size ?? undefined,
        }}
      />
    );
  }
  if (section === "animationTemplates" && typeof item === "object" && item !== null) {
    const t = item as { backdrop: Record<string, string>; spec: Record<string, string | number> };
    const bg =
      t.backdrop.mode === "gradient"
        ? { background: t.backdrop.gradient }
        : t.backdrop.mode === "photo"
          ? { backgroundImage: `url(${t.backdrop.url})`, backgroundSize: "cover" as const }
          : { backgroundColor: "#1a1a2e" };
    return (
      <div className="relative h-20 w-full overflow-hidden rounded-md" style={bg}>
        <span
          className="absolute inset-0 flex items-center justify-center text-white"
          style={{ fontFamily: t.spec.font as string, fontSize: 18, fontWeight: 900 }}
        >
          Aa
        </span>
      </div>
    );
  }
  if ((section === "photos" || section === "videos") && typeof item === "object" && item !== null) {
    const t = item as { url: string };
    return (
      <img
        src={t.url}
        alt=""
        className="h-16 w-full rounded-md object-cover"
        loading="lazy"
      />
    );
  }
  if (section === "fonts" && typeof item === "string") {
    return (
      <div className="flex h-16 items-center justify-center rounded-md bg-muted">
        <span style={{ fontFamily: item, fontSize: 28, fontWeight: 700 }}>Aa</span>
      </div>
    );
  }
  if (section === "palette" && typeof item === "string") {
    return <div className="h-12 w-full rounded-md" style={{ backgroundColor: item }} />;
  }
  if (section === "commentChips" && typeof item === "object" && item !== null) {
    const t = item as { emoji: string };
    return (
      <div className="flex h-12 items-center justify-center rounded-md bg-muted text-2xl">
        {t.emoji}
      </div>
    );
  }
  // Motion arrays (entrances, loops, tempos, rhythms)
  return null;
}

// ---------------------------------------------------------------------------
// Editable text field
// ---------------------------------------------------------------------------

function EditField({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <label className="flex flex-col gap-0.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input
        className="rounded border border-border bg-background px-2 py-1 text-sm"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { if (draft !== value) onSave(draft); }}
      />
    </label>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

function Card({
  section,
  item,
  onSave,
  onDelete,
}: {
  section: TemplateSection;
  item: unknown;
  onSave: (patched: unknown) => void;
  onDelete: () => void;
}) {
  const id = getItemId(item);
  const label = getItemLabel(item);
  const isString = typeof item === "string";
  const isMotionSection = ["entrances", "loops", "tempos", "rhythms"].includes(section);

  const handleSaveField = (key: string, val: string) => {
    if (isString) {
      onSave(val);
    } else if (typeof item === "object" && item !== null) {
      onSave({ ...(item as Record<string, unknown>), [key]: val });
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <Preview section={section} item={item} />
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5 min-w-0 flex-1">
          <span className="text-sm font-medium truncate">{label}</span>
          {isMotionSection && isString ? (
            <EditField label="value" value={item as string} onSave={(v) => onSave(v)} />
          ) : null}
          {!isString && !isMotionSection && typeof item === "object" && item !== null ? (
            <div className="grid grid-cols-2 gap-1.5">
              {"id" in (item as object) && (
                <EditField label="id" value={id} onSave={(v) => handleSaveField("id", v)} />
              )}
              {"label" in (item as object) && (
                <EditField label="label" value={label} onSave={(v) => handleSaveField("label", v)} />
              )}
              {"mood" in (item as object) && (
                <EditField label="mood" value={String((item as Record<string, unknown>).mood ?? "")} onSave={(v) => handleSaveField("mood", v)} />
              )}
              {section === "commentChips" && "emoji" in (item as object) && (
                <EditField label="emoji" value={String((item as Record<string, unknown>).emoji ?? "")} onSave={(v) => handleSaveField("emoji", v)} />
              )}
              {(section === "photos" || section === "videos") && "url" in (item as object) && (
                <EditField label="url" value={String((item as Record<string, unknown>).url ?? "")} onSave={(v) => handleSaveField("url", v)} />
              )}
              {section === "palette" && (
                <EditField label="color" value={String(item)} onSave={(v) => onSave(v)} />
              )}
              {"base" in (item as object) && (
                <EditField label="base" value={String((item as Record<string, unknown>).base ?? "")} onSave={(v) => handleSaveField("base", v)} />
              )}
            </div>
          ) : null}
          {section === "palette" && isString && (
            <EditField label="color" value={item as string} onSave={(v) => onSave(v)} />
          )}
        </div>
        <button
          onClick={onDelete}
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          title="Delete"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add form (compact — for string arrays only)
// ---------------------------------------------------------------------------

function AddStringForm({ onAdd }: { onAdd: (val: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (val.trim()) {
          onAdd(val.trim());
          setVal("");
        }
      }}
    >
      <input
        className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm"
        placeholder="New value…"
        value={val}
        onChange={(e) => setVal(e.target.value)}
      />
      <button type="submit" className="rounded bg-foreground px-3 py-1 text-xs text-background">
        Add
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function TemplateManagerPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(adminTemplatesQueryOptions());
  const [tab, setTab] = useState<TemplateSection>("gradients");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "templates"] });

  const updateMut = useMutation({
    mutationFn: (vars: { section: TemplateSection; data: unknown }) =>
      updateTemplateSection({ data: vars }),
    onSuccess: invalidate,
  });

  const deleteMut = useMutation({
    mutationFn: (vars: { section: TemplateSection; id: string }) =>
      deleteTemplateItem({ data: vars }),
    onSuccess: invalidate,
  });

  const addMut = useMutation({
    mutationFn: (vars: { section: TemplateSection; item: unknown }) =>
      addTemplateItem({ data: vars }),
    onSuccess: invalidate,
  });

  const items = useMemo(() => {
    if (!data) return [];
    return (data[tab] ?? []) as unknown[];
  }, [data, tab]);

  const handleSave = (index: number, patched: unknown) => {
    const next = [...items];
    next[index] = patched;
    updateMut.mutate({ section: tab, data: next });
  };

  const handleDelete = (item: unknown) => {
    deleteMut.mutate({ section: tab, id: getItemId(item) });
  };

  const handleAddString = (val: string) => {
    addMut.mutate({ section: tab, item: val });
  };

  const isStringArray = ["gradients", "fonts", "entrances", "loops", "tempos", "rhythms", "palette"].includes(tab);

  if (isLoading) return <p className="text-muted-foreground">Loading templates…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Templates</h1>
        <span className="text-xs text-muted-foreground">
          {items.length} items
        </span>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 border-b border-border pb-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t.key
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Add button for string sections */}
      {isStringArray && <AddStringForm onAdd={handleAddString} />}

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item, i) => (
          <Card
            key={getItemId(item) || i}
            section={tab}
            item={item}
            onSave={(patched) => handleSave(i, patched)}
            onDelete={() => handleDelete(item)}
          />
        ))}
      </div>

      {items.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No items in this section yet.
        </p>
      )}
    </div>
  );
}
