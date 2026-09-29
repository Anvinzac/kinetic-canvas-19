/**
 * Model settings page: manage multiple LLM key profiles (Together AI,
 * OpenRouter, Anthropic Claude), pick the active one, and choose a model.
 * The available model list is fetched live from the provider+key, so it
 * changes when you switch keys.
 *
 * Exports: LlmSettingsPage. Depends on: TanStack Query, llm server functions.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Loader2, Pencil, PlugZap, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  activateLlmProfile,
  deleteLlmProfile,
  listLlmSettings,
  listProviderModels,
  saveLlmProfile,
  testLlmConnection,
  type LlmProfileView,
} from "../../api/llm.functions";
import type { LlmProvider } from "../../lib/llm.server";
import { adminKeys } from "../../api/keys";

const PROVIDERS: LlmProvider[] = ["openrouter", "together", "anthropic"];

type Draft = {
  id?: string;
  provider: LlmProvider;
  label: string;
  model: string;
  apiKey: string;
};

const EMPTY_DRAFT: Draft = { provider: "openrouter", label: "", model: "", apiKey: "" };

/**
 * Curated, human-readable picks per provider — so you never need to remember
 * an exact model id. The full live catalogue (with names) is still loadable
 * below for anything not listed here.
 */
const RECOMMENDED: Record<LlmProvider, Array<{ id: string; label: string; note: string }>> = {
  openrouter: [
    { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B", note: "Natural Vietnamese, fast — recommended" },
    { id: "deepseek/deepseek-chat", label: "DeepSeek V3", note: "Strong multilingual, low cost" },
    { id: "google/gemini-flash-1.5", label: "Gemini 1.5 Flash", note: "Very fast, good everyday Vietnamese" },
    { id: "qwen/qwen-2.5-72b-instruct", label: "Qwen 2.5 72B", note: "Solid Vietnamese phrasing" },
    { id: "mistralai/mistral-large", label: "Mistral Large", note: "Higher quality, a bit slower" },
  ],
  together: [
    { id: "meta-llama/Llama-3.3-70B-Instruct-Turbo", label: "Llama 3.3 70B Turbo", note: "Natural Vietnamese, fast — recommended" },
    { id: "deepseek-ai/DeepSeek-V3", label: "DeepSeek V3", note: "Strong multilingual, low cost" },
    { id: "Qwen/Qwen2.5-72B-Instruct-Turbo", label: "Qwen 2.5 72B Turbo", note: "Solid Vietnamese phrasing" },
    { id: "google/gemma-2-27b-it", label: "Gemma 2 27B", note: "Good quality mid-range" },
    { id: "mistralai/Mixtral-8x22B-Instruct-v0.1", label: "Mixtral 8x22B", note: "Reliable, widely available" },
  ],
  anthropic: [
    { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet", note: "High quality (Vietnamese can read formal)" },
    { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku", note: "Fast, lower cost" },
    { id: "claude-sonnet-4", label: "Claude Sonnet 4", note: "Newest Sonnet" },
  ],
};


/** Friendly labels for model-id namespaces used to group the live catalogue. */
const VENDOR_LABELS: Record<string, string> = {
  "meta-llama": "Meta Llama",
  llama: "Meta Llama",
  qwen: "Qwen",
  "deepseek-ai": "DeepSeek",
  deepseek: "DeepSeek",
  google: "Google",
  mistralai: "Mistral",
  moonshotai: "Moonshot (Kimi)",
  xai: "xAI (Grok)",
  openai: "OpenAI",
  anthropic: "Anthropic",
  microsoft: "Microsoft",
  nvidia: "NVIDIA",
  nemotron: "NVIDIA Nemotron",
  writer: "Writer",
  cohere: "Cohere",
  ibm: "IBM",
  unsloth: "Unsloth",
  other: "Other",
};

function vendorLabel(ns: string): string {
  const known = VENDOR_LABELS[ns];
  if (known) return known;
  return ns
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Admin page for regeneration LLM key profiles, model selection and testing.
 * @returns model settings page
 */
export function LlmSettingsPage(): React.ReactElement {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: adminKeys.llmSettings(),
    queryFn: () => listLlmSettings(),
  });

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [adding, setAdding] = useState(false);
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([]);
  const [modelQuery, setModelQuery] = useState("");
  const [expandedVendors, setExpandedVendors] = useState<Record<string, boolean>>({});

  const refresh = () => qc.invalidateQueries({ queryKey: adminKeys.llmSettings() });

  const activateMut = useMutation({ mutationFn: (id: string) => activateLlmProfile({ data: { id } }), onSuccess: refresh });
  const deleteMut = useMutation({ mutationFn: (id: string) => deleteLlmProfile({ data: { id } }), onSuccess: refresh });
  const saveMut = useMutation({
    mutationFn: (d: Draft & { setActive?: boolean }) =>
      saveLlmProfile({ data: { id: d.id, label: d.label, provider: d.provider, model: d.model, apiKey: d.apiKey || undefined, setActive: d.setActive } }),
    onSuccess: () => {
      closeForm();
      refresh();
    },
  });
  const modelsMut = useMutation({
    mutationFn: (v: { provider: LlmProvider; apiKey?: string; id?: string }) => listProviderModels({ data: v }),
    onSuccess: (list) => setModels(list),
  });
  const testMut = useMutation({
    mutationFn: (v: { id?: string; provider?: LlmProvider; model?: string; apiKey?: string }) =>
      testLlmConnection({ data: v }),
  });

  // Load models whenever the provider or a typed key changes in the form.
  useEffect(() => {
    if (!adding) return;
    if (draft.apiKey.trim()) {
      modelsMut.mutate({ provider: draft.provider, apiKey: draft.apiKey.trim() });
    } else {
      setModels([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.provider, draft.apiKey, adding]);

  const activeId = settings.data?.activeId ?? null;
  const profiles = settings.data?.profiles ?? [];

  function startAdd() {
    setDraft(EMPTY_DRAFT);
    setModels([]);
    setExpandedVendors({});
    setModelQuery("");
    testMut.reset();
    saveMut.reset();
    setAdding(true);
  }

  function editProfile(p: LlmProfileView) {
    setDraft({ id: p.id, provider: p.provider, label: p.label, model: p.model, apiKey: "" });
    setModelQuery("");
    testMut.reset();
    saveMut.reset();
    setAdding(true);
    // Pull this profile's live catalogue using its stored key.
    modelsMut.mutate({ provider: p.provider, id: p.id });
  }

  function closeForm() {
    setAdding(false);
    setDraft(EMPTY_DRAFT);
    setModels([]);
    setExpandedVendors({});
  }

  // Group the live catalogue by vendor namespace (qwen/… and Qwen/… → one group),
  // so hundreds of models collapse into a handful of expandable providers.
  const groupedModels = useMemo(() => {
    const q = modelQuery.toLowerCase().trim();
    const groups = new Map<string, Array<{ id: string; name: string }>>();
    for (const m of models) {
      if (q && !m.id.toLowerCase().includes(q) && !m.name.toLowerCase().includes(q)) continue;
      const ns = (m.id.includes("/") ? m.id.split("/")[0] : "other").toLowerCase();
      const list = groups.get(ns);
      if (list) list.push(m);
      else groups.set(ns, [m]);
    }
    return [...groups.entries()]
      .map(([ns, list]) => ({
        ns,
        label: vendorLabel(ns),
        models: list.sort((a, b) => a.id.localeCompare(b.id)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [models, modelQuery]);

  const modelBusy = modelsMut.isPending;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Generation Model</h2>
        <p className="text-sm text-muted-foreground">
          Keys used by the vocabulary ⋮ "Regenerate with AI" action. Save several, switch the
          active one, and the model list updates for that provider. Stored locally in
          <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">llm-config.json</code>
          (gitignored — never committed).
        </p>
      </div>

      {/* ---- Saved key profiles ---- */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Saved keys</h3>
          {!adding && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted/60"
              onClick={startAdd}
            >
              <Plus size={14} /> Add key
            </button>
          )}
        </div>

        {settings.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : profiles.length === 0 && !adding ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            No keys yet — add one to enable regeneration.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {profiles.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => activateMut.mutate(p.id)}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    activeId === p.id ? "border-primary bg-primary text-primary-foreground" : "border-border"
                  }`}
                  aria-label={`Use ${p.label}`}
                  title={activeId === p.id ? "Active key" : "Set as active key"}
                >
                  {activeId === p.id && <Check size={12} />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {p.label}
                    {activeId === p.id && <span className="ml-2 text-xs text-primary">active</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.provider} · {p.model} · {p.keyHint}
                  </p>
                </div>
                <IconBtn label="Test" onClick={() => testMut.mutate({ id: p.id })} busy={testMut.isPending && testMut.variables?.id === p.id}>
                  <PlugZap size={14} />
                </IconBtn>
                <IconBtn label="Edit" onClick={() => editProfile(p)}>
                  <Pencil size={14} />
                </IconBtn>
                <IconBtn label="Delete" danger onClick={() => deleteMut.mutate(p.id)} busy={deleteMut.isPending && deleteMut.variables === p.id}>
                  <Trash2 size={14} />
                </IconBtn>
              </li>
            ))}
          </ul>
        )}

        {(testMut.isSuccess || testMut.isError) && (
          <p
            className={`rounded px-3 py-2 text-sm ${
              testMut.isSuccess ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-500"
            }`}
          >
            {testMut.isSuccess
              ? `${testMut.data.provider} · ${testMut.data.model} responded "${testMut.data.sample}" in ${testMut.data.latencyMs} ms`
              : testMut.error.message}
          </p>
        )}

        {(activateMut.isError || deleteMut.isError) && (
          <p className="rounded px-3 py-2 text-sm bg-red-500/10 text-red-500">
            {(activateMut.error ?? deleteMut.error)?.message}
          </p>
        )}
      </section>

      {/* ---- Add / edit form ---- */}
      {adding && (
        <section className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
          <h3 className="text-sm font-medium">{draft.id ? "Edit key" : "Add a key"}</h3>

          <div className="grid grid-cols-3 gap-2">
            {PROVIDERS.map((pr) => (
              <button
                key={pr}
                type="button"
                onClick={() => {
                  setDraft((d) => ({ ...d, provider: pr, model: "" }));
                  setModels([]);
                  setExpandedVendors({});
                  testMut.reset();
                  modelsMut.reset();
                }}
                className={`rounded-lg border p-2.5 text-left text-sm transition-colors ${
                  draft.provider === pr ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
                }`}
              >
                {settings.data?.providerLabels[pr] ?? pr}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="llm-label">Label</label>
            <input
              id="llm-label"
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
              placeholder={draft.provider === "openrouter" ? "OpenRouter – main" : "My key"}
              value={draft.label}
              onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="llm-key">API key</label>
            <input
              id="llm-key"
              type="password"
              autoComplete="off"
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
              placeholder={draft.id ? "Saved — leave blank to keep" : "Paste your key (loads its models)"}
              value={draft.apiKey}
              onChange={(e) => setDraft((d) => ({ ...d, apiKey: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Model</label>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
                onClick={() =>
                  draft.apiKey.trim()
                    ? modelsMut.mutate({ provider: draft.provider, apiKey: draft.apiKey.trim() })
                    : draft.id && modelsMut.mutate({ provider: draft.provider, id: draft.id })
                }
                disabled={modelBusy || (!draft.apiKey.trim() && !draft.id)}
              >
                {modelBusy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                Load all {settings.data?.providerLabels[draft.provider] ?? draft.provider} models
              </button>
            </div>

            {/* Recommended — always visible, no key or load needed. Pick by name. */}
            <div className="grid gap-1.5">
              {RECOMMENDED[draft.provider].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, model: r.id }))}
                  className={`flex items-start justify-between gap-2 rounded-md border px-3 py-1.5 text-left transition-colors ${
                    draft.model === r.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <span className="min-w-0">
                    <span className={`block text-sm font-medium ${draft.model === r.id ? "text-primary" : ""}`}>
                      {r.label}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{r.id}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-muted-foreground">{r.note}</span>
                </button>
              ))}
            </div>

            {/* Live full catalogue for anything not in the recommended list. */}
            {models.length > 0 && (
              <div className="space-y-1.5">
                <input
                  className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm"
                  placeholder={`Search all ${models.length} available models…`}
                  value={modelQuery}
                  onChange={(e) => setModelQuery(e.target.value)}
                />
                <div className="max-h-72 divide-y divide-border/60 overflow-y-auto rounded border border-border">
                  {groupedModels.map((g) => {
                    const selectedHere = g.models.some((m) => m.id === draft.model);
                    const open = expandedVendors[g.ns] ?? selectedHere;
                    const selectedTail = selectedHere
                      ? draft.model.split("/").slice(1).join("/")
                      : "";
                    return (
                      <div key={g.ns}>
                        <button
                          type="button"
                          onClick={() => setExpandedVendors((e) => ({ ...e, [g.ns]: !open }))}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50"
                        >
                          <ChevronRight
                            size={14}
                            className={`shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
                          />
                          <span className="font-medium">{g.label}</span>
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                            {g.models.length}
                          </span>
                          {selectedHere && (
                            <span className="ml-auto min-w-0 truncate text-xs text-primary">{selectedTail}</span>
                          )}
                        </button>
                        {open && (
                          <div className="border-t border-border/40 bg-muted/20">
                            {g.models.map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => setDraft((d) => ({ ...d, model: m.id }))}
                                className={`flex w-full flex-col items-start gap-0.5 border-b border-border/30 px-3 py-1.5 pl-9 text-left text-sm last:border-0 hover:bg-muted/60 ${
                                  draft.model === m.id ? "bg-primary/10" : ""
                                }`}
                              >
                                <span className={`font-medium ${draft.model === m.id ? "text-primary" : ""}`}>
                                  {m.name !== m.id ? m.name : m.id}
                                </span>
                                {m.name !== m.id && (
                                  <span className="truncate text-xs text-muted-foreground">{m.id}</span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {groupedModels.length === 0 && (
                    <p className="px-3 py-2 text-sm text-muted-foreground">No match — type a model id below.</p>
                  )}
                </div>
              </div>
            )}

            {modelBusy && (
              <p className="text-xs text-muted-foreground">Loading models for this key…</p>
            )}
            {modelsMut.isError && (
              <p className="rounded px-3 py-2 text-sm bg-red-500/10 text-red-500">{modelsMut.error.message}</p>
            )}

            <input
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
              placeholder="…or type a model id manually"
              value={draft.model}
              onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
            />
          </div>

          {saveMut.isError && <p className="text-sm text-red-500">{saveMut.error.message}</p>}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
              disabled={!draft.label.trim() || !draft.model.trim() || (!draft.apiKey.trim() && !draft.id) || saveMut.isPending}
              onClick={() => saveMut.mutate({ ...draft, setActive: profiles.length === 0 })}
            >
              {saveMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Save
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md bg-primary/80 px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
              disabled={!draft.label.trim() || !draft.model.trim() || (!draft.apiKey.trim() && !draft.id) || saveMut.isPending}
              onClick={() => saveMut.mutate({ ...draft, setActive: true })}
            >
              Save &amp; use now
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-muted/60 disabled:opacity-40"
              disabled={!draft.apiKey.trim() && !draft.id}
              onClick={() =>
                draft.apiKey.trim()
                  ? testMut.mutate({ provider: draft.provider, model: draft.model, apiKey: draft.apiKey.trim() })
                  : draft.id && testMut.mutate({ id: draft.id })
              }
            >
              <PlugZap size={14} /> Test
            </button>
            <button type="button" className="ml-auto text-sm text-muted-foreground hover:text-foreground" onClick={closeForm}>
              Cancel
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  busy,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  busy?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={label}
      title={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors disabled:opacity-40 ${
        danger ? "hover:bg-red-500/10 hover:text-red-500" : "hover:bg-muted hover:text-foreground"
      }`}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : children}
    </button>
  );
}
