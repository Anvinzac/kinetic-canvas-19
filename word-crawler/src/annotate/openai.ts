/**
 * OpenAI-compatible batch annotator — Together AI, OpenRouter, or any
 * `chat/completions` endpoint that speaks the OpenAI request/response shape.
 *
 * Responsibility: send one batch of corpus words to
 * `<baseUrl>/chat/completions` with a bearer key, read
 * `choices[0].message.content`, and hand the reply to the shared contract
 * parser. Retry/backoff/fatal handling comes from ./transport.ts, so a bad key
 * aborts the crawl here exactly the way it does for Anthropic.
 *
 * Transport facts (verified live against both providers):
 * - request  POST <baseUrl>/chat/completions
 *            authorization: Bearer <key>, content-type: application/json
 *            body { model, max_tokens, messages: [{role,content},...] }
 * - response { choices: [{ message: { content }, finish_reason }],
 *              usage: { prompt_tokens, completion_tokens } }
 * - `finish_reason` "stop" on a complete answer, "length" when truncated.
 *
 * Exports: OPENAI_COMPATIBLE_PROVIDERS, OpenAIProvider, DEFAULT_TOGETHER_MODEL,
 *          DEFAULT_OPENROUTER_MODEL, chatCompletionsUrl, extractChatContent,
 *          OpenAICompatibleBatchAnnotator, OpenAICompatibleBatchAnnotatorOptions
 * Depends on: ../corpus.ts, ./transport.ts, ./prompt.ts
 */
import type { CorpusWord } from "../corpus.ts";
import {
  LlmRequestError,
  finalizeBatch,
  postJsonWithRetry,
  type AnthropicUsage,
  type BatchAnnotationResult,
  type CompletionResult,
  type TransportOptions,
} from "./transport.ts";
import { ANNOTATION_SYSTEM_PROMPT, buildBatchPrompt } from "./prompt.ts";

/** Together AI's OpenAI-compatible default (same model the app's admin page uses). */
export const DEFAULT_TOGETHER_MODEL = "meta-llama/Llama-3.3-70B-Instruct-Turbo";

/** OpenRouter's OpenAI-compatible default (same model the app's admin page uses). */
export const DEFAULT_OPENROUTER_MODEL = "meta-llama/llama-3.3-70b-instruct";

/** One known OpenAI-compatible provider preset. */
export interface OpenAIProvider {
  /** Root without a trailing slash; `/chat/completions` is appended. */
  baseUrl: string;
  defaultModel: string;
  /** Environment variables searched for the key, in order. */
  keyEnvVars: string[];
  /** Environment variable holding an explicit model override, if any. */
  modelEnvVar: string;
}

/** Providers with a verified base URL and a sensible default model. */
export const OPENAI_COMPATIBLE_PROVIDERS: Record<string, OpenAIProvider> = {
  together: {
    baseUrl: "https://api.together.xyz/v1",
    defaultModel: DEFAULT_TOGETHER_MODEL,
    keyEnvVars: ["TOGETHER_API_KEY", "TOGETHER_KEY", "LLM_API_KEY"],
    modelEnvVar: "TOGETHER_MODEL",
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: DEFAULT_OPENROUTER_MODEL,
    keyEnvVars: ["OPENROUTER_API_KEY", "OPENROUTER_KEY", "LLM_API_KEY"],
    modelEnvVar: "OPENROUTER_MODEL",
  },
};

/** Any provider id accepted by `--provider`. */
export type OpenAIProviderName = keyof typeof OPENAI_COMPATIBLE_PROVIDERS | "openai";

/**
 * Absolute chat-completions URL for a base URL.
 * @param baseUrl - root such as `https://api.together.xyz/v1`
 * @returns `<baseUrl>/chat/completions`
 */
export function chatCompletionsUrl(baseUrl: string): string {
  const root = baseUrl.replace(/\/+$/u, "");
  return /\/chat\/completions$/u.test(root) ? root : `${root}/chat/completions`;
}

/** Read `usage.prompt_tokens` / `usage.completion_tokens` when present. */
function readUsage(payload: unknown): AnthropicUsage | null {
  const usage = (payload as { usage?: unknown } | null)?.usage;
  if (typeof usage !== "object" || usage === null) return null;
  const record = usage as Record<string, unknown>;
  const inputTokens = typeof record.prompt_tokens === "number" ? record.prompt_tokens : null;
  const outputTokens = typeof record.completion_tokens === "number" ? record.completion_tokens : null;
  if (inputTokens === null || outputTokens === null) return null;
  return { inputTokens, outputTokens };
}

/**
 * Pull the assistant reply out of a chat-completions response.
 *
 * Reasoning models make the empty-content case common and confusing: they put
 * their chain of thought in `reasoning_content`, which is billed against the
 * same `max_tokens`, so a budget that is merely tight returns
 * `finish_reason: "length"` with `content: ""`. Reporting that as "no message
 * content" sends the reader looking for a broken provider instead of raising
 * `--max-tokens`, so the error says which it is and how big the reasoning was.
 *
 * @param payload - parsed response body
 * @returns the message content (empty string becomes a failure, not a silent pass)
 * @throws LlmRequestError when the response has no usable choice
 */
export function extractChatContent(payload: unknown): string {
  const choices = (payload as { choices?: unknown } | null)?.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new LlmRequestError("Chat response has no choices");
  }
  const first = choices[0] as Record<string, unknown> | null;
  const message = (first as { message?: unknown } | null)?.message;
  const record = typeof message === "object" && message !== null ? (message as Record<string, unknown>) : {};
  const content = record.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    const finishReason = typeof first?.finish_reason === "string" ? first.finish_reason : "";
    const reasoning = typeof record.reasoning_content === "string" ? record.reasoning_content : "";
    if (finishReason === "length") {
      const spent =
        reasoning.length > 0
          ? ` The whole budget went to reasoning (${reasoning.length} characters of it).`
          : "";
      throw new LlmRequestError(
        `Chat response was cut off before any answer (finish_reason=length).${spent} Raise --max-tokens or lower --batch.`,
      );
    }
    if (reasoning.length > 0) {
      throw new LlmRequestError(
        `Chat response returned only reasoning (${reasoning.length} characters) and no answer`,
      );
    }
    throw new LlmRequestError("Chat response has no message content");
  }
  return content;
}

/** Options for {@link OpenAICompatibleBatchAnnotator}. */
export interface OpenAICompatibleBatchAnnotatorOptions extends TransportOptions {
  apiKey: string;
  /** Root URL of the OpenAI-compatible API (required). */
  baseUrl: string;
  model?: string;
  /** Provider label used in log lines and error messages. */
  label?: string;
  /** Model used when `model` is unset; the CLI passes the provider preset's default. */
  defaultModel?: string;
  /** Response token budget (default 4000; a 20-word batch stays well below it). */
  maxTokens?: number;
  /** Sampling temperature; omitted from the request when unset. */
  temperature?: number;
}

/**
 * OpenAI-compatible batch annotator. One instance is reused for every batch of a crawl.
 */
export class OpenAICompatibleBatchAnnotator {
  readonly model: string;
  readonly baseUrl: string;
  readonly label: string;
  private readonly options: OpenAICompatibleBatchAnnotatorOptions;
  private readonly maxTokens: number;

  constructor(options: OpenAICompatibleBatchAnnotatorOptions) {
    if (options.apiKey.trim().length === 0) {
      throw new LlmRequestError(
        "No API key for the OpenAI-compatible provider. Set TOGETHER_API_KEY, OPENROUTER_API_KEY or LLM_API_KEY, or use --dry-run.",
      );
    }
    if (options.baseUrl.trim().length === 0) {
      throw new LlmRequestError("An OpenAI-compatible provider needs a base URL (--base-url).");
    }
    this.options = options;
    this.baseUrl = options.baseUrl;
    this.label = options.label ?? "OpenAI-compatible";
    this.model = options.model ?? options.defaultModel ?? DEFAULT_TOGETHER_MODEL;
    this.maxTokens = options.maxTokens ?? 4000;
  }

  /**
   * Annotate one batch of corpus words.
   *
   * @param words - corpus words for this batch (non-empty)
   * @returns validated annotations plus missing words, issues and token usage
   * @throws LlmRequestError when the request fails after all attempts
   */
  async annotateBatch(words: readonly CorpusWord[]): Promise<BatchAnnotationResult> {
    const requested = words.map((entry) => entry.word);
    if (requested.length === 0) {
      return {
        requested,
        annotations: [],
        missing: [],
        issues: ["empty batch skipped"],
        usage: null,
        stopReason: null,
      };
    }

    const completion = await this.complete(buildBatchPrompt(words));
    return finalizeBatch(words, completion);
  }

  /** POST one chat request and reduce the reply to text + usage + stop reason. */
  private async complete(prompt: string): Promise<CompletionResult> {
    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: this.maxTokens,
      messages: [
        { role: "system", content: ANNOTATION_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    };
    if (this.options.temperature !== undefined) body.temperature = this.options.temperature;

    const payload = await postJsonWithRetry(
      chatCompletionsUrl(this.baseUrl),
      {
        "content-type": "application/json",
        authorization: `Bearer ${this.options.apiKey}`,
      },
      JSON.stringify(body),
      this.label,
      this.options,
    );

    const choices = Array.isArray(payload.choices) ? (payload.choices as unknown[]) : [];
    const finishReason =
      typeof (choices[0] as { finish_reason?: unknown } | undefined)?.finish_reason === "string"
        ? ((choices[0] as { finish_reason: string }).finish_reason)
        : null;
    // Normalize the OpenAI "length" to the Anthropic "max_tokens" the pipeline warns on.
    const stopReason = finishReason === "length" ? "max_tokens" : finishReason;

    return { text: extractChatContent(payload), usage: readUsage(payload), stopReason };
  }
}
