/**
 * Anthropic batch annotator — the only place that talks to the network.
 *
 * Responsibility: send one batch of corpus words to the Anthropic Messages API,
 * extract the JSON array from the response text blocks, validate every item
 * against the crawler annotation contract, and retry transient failures with
 * exponential backoff plus jitter.
 *
 * Everything non-deterministic (fetch, sleep, random, clock-free retry-after
 * math) is injectable, so tests run offline against a mocked fetch.
 *
 * Verified transport facts: POST https://api.anthropic.com/v1/messages with
 * headers content-type, x-api-key, anthropic-version: 2023-06-01; retryable
 * statuses are 429, 500, 504 and 529 (Retry-After is honored when present).
 *
 * Exports: ANTHROPIC_MESSAGES_URL, ANTHROPIC_VERSION, DEFAULT_ANTHROPIC_MODEL,
 *          RETRYABLE_STATUSES, AnthropicRequestError, BatchAnnotationResult,
 *          extractContentText, extractJsonArray, isRetryableStatus,
 *          parseRetryAfterMs, AnthropicBatchAnnotator
 * Depends on: ../corpus.ts, ./contract.ts, ./prompt.ts
 */
import type { CorpusWord } from "../corpus.ts";
import { parseAnnotationList, type CrawlerAnnotation } from "./contract.ts";
import { ANNOTATION_SYSTEM_PROMPT, buildBatchPrompt } from "./prompt.ts";

/** Anthropic Messages endpoint (verified). */
export const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";

/** Required API version header (verified). */
export const ANTHROPIC_VERSION = "2023-06-01";

/** Same default model family content-hub uses; override with --model or ANTHROPIC_MODEL. */
export const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

/** The only HTTP statuses this crawler retries (verified transient set). */
export const RETRYABLE_STATUSES: readonly number[] = [429, 500, 504, 529];

/** Statuses that mean "fix configuration, do not retry, do not continue crawling". */
const FATAL_STATUSES: readonly number[] = [400, 401, 403, 404];

/** Token counts reported by the API for one request. */
export interface AnthropicUsage {
  inputTokens: number;
  outputTokens: number;
}

/** Outcome of one batch: usable annotations plus a report of what was missing or repaired. */
export interface BatchAnnotationResult {
  requested: string[];
  annotations: CrawlerAnnotation[];
  missing: string[];
  issues: string[];
  usage: AnthropicUsage | null;
  stopReason: string | null;
}

/** Transport or protocol failure. `fatal` tells the pipeline to stop the whole run. */
export class AnthropicRequestError extends Error {
  readonly status: number | null;
  readonly fatal: boolean;
  readonly bodySnippet: string;

  constructor(
    message: string,
    options: { status?: number | null; fatal?: boolean; bodySnippet?: string } = {},
  ) {
    super(message);
    this.name = "AnthropicRequestError";
    this.status = options.status ?? null;
    this.fatal = options.fatal ?? false;
    this.bodySnippet = options.bodySnippet ?? "";
  }
}

/**
 * True when a status is in the verified transient set.
 * @param status - HTTP status code
 */
export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUSES.includes(status);
}

/**
 * Read `retry-after` in seconds or HTTP-date form.
 * @param response - the failed HTTP response
 * @param now - current epoch millis (injectable for tests)
 * @returns delay in milliseconds, or null when the header is absent/unusable
 */
export function parseRetryAfterMs(response: Response, now = Date.now()): number | null {
  const header = response.headers.get("retry-after");
  if (header === null || header.trim().length === 0) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds * 1000));
  const timestamp = Date.parse(header);
  if (!Number.isNaN(timestamp)) return Math.max(0, timestamp - now);
  return null;
}

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
 * @throws AnthropicRequestError when no text block exists
 */
export function extractContentText(payload: unknown): string {
  const content = (payload as { content?: unknown } | null)?.content;
  if (!Array.isArray(content)) {
    throw new AnthropicRequestError("Anthropic response has no content array");
  }
  const parts = content.filter(isTextBlock).map((block) => block.text);
  if (parts.length === 0) {
    throw new AnthropicRequestError("Anthropic response has no text content block");
  }
  return parts.join("\n");
}

/** Remove markdown fence lines (` ``` ` / ` ```json `) without touching JSON payload lines. */
function stripFenceLines(value: string): string {
  return value.replace(/^[ \t]*```[A-Za-z-]*[ \t]*$/gm, "");
}

/**
 * Collect every top-level `[...]` substring, ignoring brackets inside strings.
 * The first candidate that parses as JSON wins in {@link extractJsonArray}.
 *
 * @param value - text to scan
 * @returns candidate substrings in order of appearance
 */
function findBalancedArrays(value: string): string[] {
  const candidates: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "[") {
      if (depth === 0) start = index;
      depth += 1;
    } else if (char === "]" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        candidates.push(value.slice(start, index + 1));
        start = -1;
      }
    }
  }
  return candidates;
}

/**
 * Extract the JSON array a model returned, tolerating prose around it and
 * markdown code fences.
 *
 * @param rawText - model text (one or more concatenated text blocks)
 * @returns the parsed array
 * @throws AnthropicRequestError when no parseable array is found
 */
export function extractJsonArray(rawText: string): unknown[] {
  const text = stripFenceLines(rawText);
  try {
    const whole = JSON.parse(text) as unknown;
    if (Array.isArray(whole)) return whole;
  } catch {
    // Fall through to the balanced scan — prose around the array is expected.
  }
  for (const candidate of findBalancedArrays(text)) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Try the next candidate.
    }
  }
  throw new AnthropicRequestError("Model text does not contain a JSON array");
}

/** Options for {@link AnthropicBatchAnnotator}. All non-essential values have defaults. */
export interface AnthropicBatchAnnotatorOptions {
  apiKey: string;
  model?: string;
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Injected for tests; defaults to a real timer. */
  sleep?: (ms: number) => Promise<void>;
  /** Injected for tests; defaults to Math.random. Used for jitter only. */
  random?: () => number;
  /** Total attempts per request, including the first (default 4). */
  maxAttempts?: number;
  /** First backoff step in milliseconds (default 1000). */
  baseDelayMs?: number;
  /** Backoff ceiling in milliseconds (default 30000). */
  maxDelayMs?: number;
  /** Response token budget (default 4000; a 20-word batch stays well below it). */
  maxTokens?: number;
  /** Per-request timeout (default 120000 ms). */
  timeoutMs?: number;
  /** Progress/retry logger; silent by default. */
  log?: (message: string) => void;
}

/**
 * Batch annotator client. One instance is reused for every batch of a crawl.
 */
export class AnthropicBatchAnnotator {
  readonly model: string;
  private readonly options: AnthropicBatchAnnotatorOptions;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly maxTokens: number;
  private readonly timeoutMs: number;
  private readonly log: (message: string) => void;

  constructor(options: AnthropicBatchAnnotatorOptions) {
    if (options.apiKey.trim().length === 0) {
      throw new AnthropicRequestError(
        "ANTHROPIC_API_KEY is missing. Copy .env.example to .env and fill it in, or use --dry-run.",
      );
    }
    this.options = options;
    this.model = options.model ?? DEFAULT_ANTHROPIC_MODEL;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep =
      options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.random = options.random ?? Math.random;
    this.maxAttempts = options.maxAttempts ?? 4;
    this.baseDelayMs = options.baseDelayMs ?? 1000;
    this.maxDelayMs = options.maxDelayMs ?? 30_000;
    this.maxTokens = options.maxTokens ?? 4000;
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.log = options.log ?? (() => {});
  }

  /**
   * Annotate one batch of corpus words.
   *
   * @param words - corpus words for this batch (non-empty)
   * @returns validated annotations plus missing words, issues and token usage
   * @throws AnthropicRequestError when the request fails after all attempts
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

    const payload = await this.request(buildBatchPrompt(words));
    const text = extractContentText(payload);
    const items = extractJsonArray(text);
    const { annotations: byWord, issues } = parseAnnotationList(items, requested);

    const stopReason = typeof payload.stop_reason === "string" ? payload.stop_reason : null;
    if (stopReason === "max_tokens") {
      issues.unshift("response was truncated (stop_reason=max_tokens); lower --batch or raise --max-tokens");
    }

    const annotations: CrawlerAnnotation[] = [];
    const missing: string[] = [];
    for (const word of requested) {
      const annotation = byWord.get(word);
      if (annotation === undefined) missing.push(word);
      else annotations.push(annotation);
    }

    return { requested, annotations, missing, issues, usage: readUsage(payload), stopReason };
  }

  /**
   * POST one Messages request, retrying only the verified transient statuses
   * (and transport errors) with exponential backoff and jitter.
   */
  private async request(prompt: string): Promise<Record<string, unknown>> {
    const body = JSON.stringify({
      model: this.model,
      max_tokens: this.maxTokens,
      system: ANNOTATION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetchImpl(ANTHROPIC_MESSAGES_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": this.options.apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
          },
          body,
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (error) {
        // Transport failures (DNS, reset, timeout) have no status; retry them
        // like the transient server statuses.
        if (attempt < this.maxAttempts) {
          const delay = this.backoffDelay(attempt);
          this.log(`network error on attempt ${attempt}, retrying in ${delay} ms`);
          await this.sleep(delay);
          continue;
        }
        const reason = error instanceof Error ? error.message : String(error);
        throw new AnthropicRequestError(`Anthropic request failed: ${reason}`);
      }

      if (response.ok) {
        return (await response.json()) as Record<string, unknown>;
      }

      const bodySnippet = await readBodySnippet(response);
      const fatal = FATAL_STATUSES.includes(response.status);
      const retryable = isRetryableStatus(response.status);

      if (retryable && attempt < this.maxAttempts) {
        const delay = parseRetryAfterMs(response) ?? this.backoffDelay(attempt);
        this.log(
          `HTTP ${response.status} on attempt ${attempt}, retrying in ${delay} ms`,
        );
        await this.sleep(delay);
        continue;
      }

      throw new AnthropicRequestError(
        `Anthropic request failed with HTTP ${response.status}${bodySnippet ? `: ${bodySnippet}` : ""}`,
        { status: response.status, fatal, bodySnippet },
      );
    }

    throw new AnthropicRequestError("Anthropic request exhausted all attempts");
  }

  /** Exponential cap with 50-100% jitter; attempt 1 = baseDelayMs. */
  private backoffDelay(attempt: number): number {
    const cap = Math.min(this.maxDelayMs, this.baseDelayMs * 2 ** (attempt - 1));
    return Math.round(cap * (0.5 + 0.5 * this.random()));
  }
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

/** Short, safe excerpt of an error body for logs and thrown messages. */
async function readBodySnippet(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.replace(/\s+/g, " ").trim().slice(0, 300);
  } catch {
    return "";
  }
}
