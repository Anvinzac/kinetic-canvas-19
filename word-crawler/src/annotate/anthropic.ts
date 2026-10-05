/**
 * Anthropic batch annotator — talks to the Anthropic Messages API.
 *
 * Responsibility: send one batch of corpus words to
 * `https://api.anthropic.com/v1/messages`, read the text blocks, and hand the
 * reply to the shared contract parser. The retry policy, fatal classification
 * and JSON extraction live in ./transport.ts so this client and the
 * OpenAI-compatible one cannot drift apart.
 *
 * Exports: ANTHROPIC_MESSAGES_URL, ANTHROPIC_VERSION, DEFAULT_ANTHROPIC_MODEL,
 *          AnthropicRequestError (alias of the shared LlmRequestError),
 *          RETRYABLE_STATUSES, FATAL_STATUSES, BatchAnnotationResult,
 *          AnthropicUsage, extractContentText, extractJsonArray,
 *          isRetryableStatus, parseRetryAfterMs, AnthropicBatchAnnotator
 * Depends on: ../corpus.ts, ./transport.ts, ./prompt.ts
 */
import type { CorpusWord } from "../corpus.ts";
import {
  FATAL_STATUSES,
  LlmRequestError,
  RETRYABLE_STATUSES,
  extractJsonArray,
  finalizeBatch,
  isRetryableStatus,
  parseRetryAfterMs,
  postJsonWithRetry,
  type AnthropicUsage,
  type BatchAnnotationResult,
  type CompletionResult,
  type TransportOptions,
} from "./transport.ts";
import { ANNOTATION_SYSTEM_PROMPT, buildBatchPrompt } from "./prompt.ts";

/** Anthropic Messages endpoint (verified). */
export const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";

/** Required API version header (verified). */
export const ANTHROPIC_VERSION = "2023-06-01";

/** Same default model family content-hub uses; override with --model or ANTHROPIC_MODEL. */
export const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

/**
 * Provider-neutral transport error, kept under its historical name so existing
 * imports and `instanceof` checks in the pipeline keep working.
 */
export const AnthropicRequestError = LlmRequestError;
export type AnthropicRequestError = LlmRequestError;

export {
  RETRYABLE_STATUSES,
  FATAL_STATUSES,
  extractJsonArray,
  isRetryableStatus,
  parseRetryAfterMs,
  type AnthropicUsage,
  type BatchAnnotationResult,
};

/** True for an Anthropic text content block. */
function isTextBlock(block: unknown): block is { type: "text"; text: string } {
  return (
    typeof block === "object" &&
    block !== null &&
    (block as { type?: unknown }).type === "text" &&
    typeof (block as { text?: unknown }).text === "string"
  );
}

/**
 * Concatenate every text block of a Messages API response.
 *
 * @param payload - parsed response body
 * @returns the concatenated model text
 * @throws LlmRequestError when no text block exists
 */
export function extractContentText(payload: unknown): string {
  const content = (payload as { content?: unknown } | null)?.content;
  if (!Array.isArray(content)) {
    throw new LlmRequestError("Anthropic response has no content array");
  }
  const parts = content.filter(isTextBlock).map((block) => block.text);
  if (parts.length === 0) {
    throw new LlmRequestError("Anthropic response has no text content block");
  }
  return parts.join("\n");
}

/** Read `usage.input_tokens` / `usage.output_tokens` when present. */
function readUsage(payload: unknown): AnthropicUsage | null {
  const usage = (payload as { usage?: unknown } | null)?.usage;
  if (typeof usage !== "object" || usage === null) return null;
  const record = usage as Record<string, unknown>;
  const inputTokens = typeof record.input_tokens === "number" ? record.input_tokens : null;
  const outputTokens = typeof record.output_tokens === "number" ? record.output_tokens : null;
  if (inputTokens === null || outputTokens === null) return null;
  return { inputTokens, outputTokens };
}

/** Options for {@link AnthropicBatchAnnotator}. All non-essential values have defaults. */
export interface AnthropicBatchAnnotatorOptions extends TransportOptions {
  apiKey: string;
  model?: string;
  /** Response token budget (default 4000; a 20-word batch stays well below it). */
  maxTokens?: number;
}

/**
 * Anthropic batch annotator. One instance is reused for every batch of a crawl.
 */
export class AnthropicBatchAnnotator {
  readonly model: string;
  private readonly options: AnthropicBatchAnnotatorOptions;
  private readonly maxTokens: number;

  constructor(options: AnthropicBatchAnnotatorOptions) {
    if (options.apiKey.trim().length === 0) {
      throw new LlmRequestError(
        "ANTHROPIC_API_KEY is missing. Copy .env.example to .env and fill it in, or use --dry-run.",
      );
    }
    this.options = options;
    this.model = options.model ?? DEFAULT_ANTHROPIC_MODEL;
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

  /** POST one Messages request and reduce the reply to text + usage + stop reason. */
  private async complete(prompt: string): Promise<CompletionResult> {
    const body = JSON.stringify({
      model: this.model,
      max_tokens: this.maxTokens,
      system: ANNOTATION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const payload = await postJsonWithRetry(
      ANTHROPIC_MESSAGES_URL,
      {
        "content-type": "application/json",
        "x-api-key": this.options.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body,
      "Anthropic",
      this.options,
    );

    const stopReason = typeof payload.stop_reason === "string" ? payload.stop_reason : null;
    return { text: extractContentText(payload), usage: readUsage(payload), stopReason };
  }
}
