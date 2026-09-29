/**
 * Server-only LLM configuration + chat completion for admin regeneration.
 * Supports multiple saved key profiles across Together AI, OpenRouter and
 * Anthropic Claude. The active profile drives vocabulary regeneration; each
 * profile carries its own provider/key/model so switching keys also switches
 * the model catalogue. Stored in src/features/admin/data/llm-config.json
 * (gitignored) — keys are never shipped to the browser.
 *
 * Exports: LlmProvider, LlmProfile, LlmConfig, readLlmStore, getActiveConfig,
 * writeLlmStore, llmChat, fetchProviderModels, DEFAULT_MODELS
 * Depends on: node:fs/promises, node:path, node:process.
 */

import process from "node:process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export type LlmProvider = "together" | "openrouter" | "anthropic";

/** Chat-capable subset — what llmChat needs to make one request. */
export type LlmConfig = {
  provider: LlmProvider;
  model: string;
  apiKey: string;
};

/** A named saved key. `id` is stable so the UI can select/edit/delete it. */
export type LlmProfile = LlmConfig & {
  id: string;
  label: string;
};

type LlmStore = {
  version: 2;
  activeId: string | null;
  profiles: LlmProfile[];
};

export const LLM_CONFIG_PATH = resolve(
  process.cwd(),
  "src/features/admin/data/llm-config.json",
);

const PROVIDER_BASE: Record<LlmProvider, string> = {
  together: "https://api.together.xyz/v1",
  openrouter: "https://openrouter.ai/api/v1",
  anthropic: "https://api.anthropic.com/v1",
};

export const PROVIDER_LABELS: Record<LlmProvider, string> = {
  together: "Together AI",
  openrouter: "OpenRouter",
  anthropic: "Anthropic Claude",
};

export const DEFAULT_MODELS: Record<LlmProvider, string> = {
  together: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  openrouter: "meta-llama/llama-3.3-70b-instruct",
  anthropic: "claude-haiku-4-5-20251001",
};

function profileId(provider: LlmProvider, key: string): string {
  const tail = key.slice(-6).replace(/[^a-zA-Z0-9]/g, "");
  return `${provider}_${tail || Date.now().toString(36)}`;
}

/** Normalise a legacy single-key config ({provider,model,apiKey}) into a store. */
function migrateLegacy(parsed: Partial<LlmConfig> & Partial<LlmStore>): LlmStore | null {
  if (Array.isArray(parsed.profiles)) {
    const profiles = (parsed.profiles as LlmProfile[]).filter((p) => p?.apiKey && p?.provider);
    const activeId =
      parsed.activeId && profiles.some((p) => p.id === parsed.activeId)
        ? parsed.activeId
        : profiles[0]?.id ?? null;
    return { version: 2, activeId, profiles };
  }
  if (parsed.apiKey && parsed.provider) {
    const id = profileId(parsed.provider, parsed.apiKey);
    const profile: LlmProfile = {
      id,
      label: PROVIDER_LABELS[parsed.provider],
      provider: parsed.provider,
      model: parsed.model || DEFAULT_MODELS[parsed.provider],
      apiKey: parsed.apiKey,
    };
    return { version: 2, activeId: id, profiles: [profile] };
  }
  return null;
}

/** Read the key-profile store, seeding from ANTHROPIC_API_KEY env when empty. */
export async function readLlmStore(): Promise<LlmStore> {
  try {
    const raw = await readFile(LLM_CONFIG_PATH, "utf-8");
    const store = migrateLegacy(JSON.parse(raw) as LlmStore & LlmConfig);
    if (store) return store;
  } catch {
    /* missing/invalid file — fall through */
  }

  const envKey = process.env.ANTHROPIC_API_KEY;
  if (envKey && envKey.startsWith("sk-")) {
    const id = profileId("anthropic", envKey);
    return {
      version: 2,
      activeId: id,
      profiles: [
        {
          id,
          label: "Anthropic (env)",
          provider: "anthropic",
          model: process.env.CLAUDE_MODEL || DEFAULT_MODELS.anthropic,
          apiKey: envKey,
        },
      ],
    };
  }
  return { version: 2, activeId: null, profiles: [] };
}

export async function writeLlmStore(store: LlmStore): Promise<void> {
  await writeFile(LLM_CONFIG_PATH, JSON.stringify(store, null, 2) + "\n", "utf-8");
}

/** The chat config for the currently active profile (null if none). */
export async function getActiveConfig(): Promise<LlmConfig | null> {
  const store = await readLlmStore();
  const active = store.profiles.find((p) => p.id === store.activeId) ?? store.profiles[0];
  if (!active) return null;
  return { provider: active.provider, model: active.model, apiKey: active.apiKey };
}

/** Back-compat alias used by regeneration. */
export const readLlmConfig = getActiveConfig;

export type ChatRequest = {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
};

/** Send one chat request to the configured provider and return the text. */
export async function llmChat(cfg: LlmConfig, req: ChatRequest): Promise<string> {
  if (cfg.provider === "anthropic") {
    const res = await fetch(`${PROVIDER_BASE.anthropic}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": cfg.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: req.maxTokens ?? 256,
        temperature: req.temperature ?? 0.8,
        system: req.system,
        messages: [{ role: "user", content: req.user }],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Anthropic API error ${res.status}: ${body}`.slice(0, 300));
    }
    const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    return (json.content?.find((b) => b.type === "text")?.text ?? "").trim();
  }

  // Together + OpenRouter are OpenAI-compatible chat/completions endpoints.
  const headers: Record<string, string> = {
    "content-type": "application/json",
    Authorization: `Bearer ${cfg.apiKey}`,
  };
  if (cfg.provider === "openrouter") {
    headers["X-Title"] = "KineMedia Vocabulary Admin";
  }
  const res = await fetch(`${PROVIDER_BASE[cfg.provider]}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: req.maxTokens ?? 256,
      temperature: req.temperature ?? 0.8,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const name = PROVIDER_LABELS[cfg.provider];
    throw new Error(`${name} API error ${res.status}: ${body}`.slice(0, 300));
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return (json.choices?.[0]?.message?.content ?? "").trim();
}

export type ProviderModel = { id: string; name: string };

/**
 * The Model page selects chat-completion models only — they regenerate
 * Vietnamese text. Provider catalogues also list image / video / audio /
 * embedding endpoints, so those are filtered out below.
 */
const TOGETHER_TEXT_TYPES = new Set(["chat", "language", "code"]);

/** Fallback for entries without modality metadata (e.g. Anthropic). */
const NON_TEXT_NAME =
  /(image|video|audio|tts|asr|whisper|flux|dall|diffusion|seedream|seedance|speech|transcri|embed|rerank|sound|music|voice|kling|cogvideo)/i;

function isTextGenerationModel(
  provider: LlmProvider,
  entry: Record<string, unknown>,
  id: string,
  name: string,
): boolean {
  if (provider === "together" && typeof entry.type === "string") {
    return TOGETHER_TEXT_TYPES.has(entry.type);
  }
  if (provider === "openrouter") {
    const arch = entry.architecture as
      | { modality?: string; output_modalities?: string[] }
      | undefined;
    if (arch?.output_modalities?.length) {
      return arch.output_modalities.every((m) => m === "text");
    }
    if (typeof arch?.modality === "string") {
      const out = (arch.modality.split("->")[1] ?? "").trim();
      return out.length > 0 && out.split("+").every((m) => m.trim() === "text");
    }
  }
  return !NON_TEXT_NAME.test(id) && !NON_TEXT_NAME.test(name);
}

/** Fetch the text-generation model catalogue available to a given provider + key. */
export async function fetchProviderModels(cfg: LlmConfig): Promise<ProviderModel[]> {
  const headers: Record<string, string> = { Authorization: `Bearer ${cfg.apiKey}` };
  let url = `${PROVIDER_BASE[cfg.provider]}/models`;
  if (cfg.provider === "anthropic") {
    url = `${PROVIDER_BASE.anthropic}/models`;
    headers["x-api-key"] = cfg.apiKey;
    headers["anthropic-version"] = "2023-06-01";
  }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${PROVIDER_LABELS[cfg.provider]} models error ${res.status}: ${body}`.slice(0, 200));
  }
  const json = (await res.json()) as Record<string, unknown>;
  const list = (Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : []) as Array<
    Record<string, unknown>
  >;
  return list
    .map((m) => {
      const id = typeof m.id === "string" ? m.id : "";
      const name =
        typeof m.name === "string" ? m.name : typeof m.display_name === "string" ? m.display_name : id;
      return { entry: m, model: { id, name } };
    })
    .filter(({ entry, model }) => model.id && isTextGenerationModel(cfg.provider, entry, model.id, model.name))
    .map(({ model }) => model)
    .sort((a, b) => a.id.localeCompare(b.id));
}
