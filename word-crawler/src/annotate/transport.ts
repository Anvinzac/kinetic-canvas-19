/**
 * Shared LLM transport — retry policy, fatal classification, JSON extraction.
 *
 * Responsibility: hold everything that is provider-independent so the Anthropic
 * client and the OpenAI-compatible client cannot drift apart on the rules that
 * protect a crawl run: which HTTP statuses may be retried, which ones abort the
 * whole crawl, how long to back off, and how a JSON array is recovered from a
 * chatty model's text.
 *
 * Everything non-deterministic (fetch, sleep, random, retry-after math) is
 * injectable, so tests run offline against a mocked fetch.
 *
 * Verified transport facts (Anthropic): retryable 429/500/504/529, fatal
 * 400/401/403/404, `retry-after` sent in seconds. The OpenAI-compatible
 * providers (Together, OpenRouter) use the same transient/fatal split.
 *
 * Exports: RETRYABLE_STATUSES, FATAL_STATUSES, LlmRequestError, TransportOptions,
 *          CompletionResult, BatchAnnotationResult, AnthropicUsage,
 *          isRetryableStatus, parseRetryAfterMs, extractJsonArray,
 *          postJsonWithRetry, finalizeBatch
 * Depends on: ../corpus.ts, ./contract.ts
 */
import type { CorpusWord } from "../corpus.ts";
import { parseAnnotationList, type CrawlerAnnotation } from "./contract.ts";

/** Token counts reported by a provider for one request. */
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

/** A model reply reduced to the three things the pipeline needs. */
export interface CompletionResult {
  text: string;
  usage: AnthropicUsage | null;
  /** Normalized reason: `max_tokens` when the reply was cut off, else `end_turn`. */
  stopReason: string | null;
}

/** The HTTP statuses worth retrying. */
export const RETRYABLE_STATUSES: readonly number[] = [429, 500, 504, 529];

/** Statuses meaning "fix configuration, do not retry, do not keep crawling". */
export const FATAL_STATUSES: readonly number[] = [400, 401, 403, 404];

/** Transport or protocol failure. `fatal` tells the pipeline to stop the whole run. */
export class LlmRequestError extends Error {
  readonly status: number | null;
  readonly fatal: boolean;
  readonly bodySnippet: string;

  constructor(
    message: string,
    options: { status?: number | null; fatal?: boolean; bodySnippet?: string } = {},
  ) {
    super(message);
    this.name = "LlmRequestError";
    this.status = options.status ?? null;
    this.fatal = options.fatal ?? false;
    this.bodySnippet = options.bodySnippet ?? "";
  }
}

/** Injectable transport collaborators; every one has a production default. */
export interface TransportOptions {
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
  /** Per-request timeout (default 120000 ms). */
  timeoutMs?: number;
  /** Progress/retry logger; silent by default. */
  log?: (message: string) => void;
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
 * @param rawText - model text
 * @returns the parsed array
 * @throws LlmRequestError when no parseable array is found
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
  throw new LlmRequestError("Model text does not contain a JSON array");
}

/** Exponential cap with 50-100% jitter; attempt 1 = baseDelayMs. */
function backoffDelay(attempt: number, baseDelayMs: number, maxDelayMs: number, random: () => number): number {
  const cap = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
  return Math.round(cap * (0.5 + 0.5 * random()));
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

/**
 * POST one completion request and return the parsed body, retrying only the
 * verified transient statuses (and transport errors) with exponential backoff
 * and jitter.
 *
 * @param url - absolute endpoint URL
 * @param headers - request headers, including the provider's auth header
 * @param body - serialized JSON request body
 * @param label - provider name used in error messages
 * @param options - injectable transport collaborators
 * @returns parsed response body
 * @throws LlmRequestError when the request fails after all attempts
 */
export async function postJsonWithRetry(
  url: string,
  headers: Record<string, string>,
  body: string,
  label: string,
  options: TransportOptions = {},
): Promise<Record<string, unknown>> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const random = options.random ?? Math.random;
  const maxAttempts = options.maxAttempts ?? 4;
  const baseDelayMs = options.baseDelayMs ?? 1000;
  const maxDelayMs = options.maxDelayMs ?? 30_000;
  const timeoutMs = options.timeoutMs ?? 120_000;
  const log = options.log ?? (() => {});

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      // Transport failures (DNS, reset, timeout) have no status; retry them
      // like the transient server statuses.
      if (attempt < maxAttempts) {
        const delay = backoffDelay(attempt, baseDelayMs, maxDelayMs, random);
        log(`${label}: network error on attempt ${attempt}, retrying in ${delay} ms`);
        await sleep(delay);
        continue;
      }
      const reason = error instanceof Error ? error.message : String(error);
      throw new LlmRequestError(`${label} request failed: ${reason}`);
    }

    if (response.ok) {
      return (await response.json()) as Record<string, unknown>;
    }

    const bodySnippet = await readBodySnippet(response);
    const retryable = isRetryableStatus(response.status);

    if (retryable && attempt < maxAttempts) {
      const delay = parseRetryAfterMs(response) ?? backoffDelay(attempt, baseDelayMs, maxDelayMs, random);
      log(`${label}: HTTP ${response.status} on attempt ${attempt}, retrying in ${delay} ms`);
      await sleep(delay);
      continue;
    }

    throw new LlmRequestError(
      `${label} request failed with HTTP ${response.status}${bodySnippet ? `: ${bodySnippet}` : ""}`,
      { status: response.status, fatal: FATAL_STATUSES.includes(response.status), bodySnippet },
    );
  }

  throw new LlmRequestError(`${label} request exhausted all attempts`);
}

/**
 * Turn one completion into validated annotations for the batch that was asked for.
 *
 * @param words - corpus words requested in this batch
 * @param completion - the model's text plus usage and stop reason
 * @returns annotations, missing words, issues and the reported usage
 */
export function finalizeBatch(
  words: readonly CorpusWord[],
  completion: CompletionResult,
): BatchAnnotationResult {
  const requested = words.map((entry) => entry.word);
  const items = extractJsonArray(completion.text);
  const { annotations: byWord, issues } = parseAnnotationList(items, requested);

  if (completion.stopReason === "max_tokens") {
    issues.unshift("response was truncated (max_tokens); lower --batch or raise --max-tokens");
  }

  const annotations: CrawlerAnnotation[] = [];
  const missing: string[] = [];
  for (const word of requested) {
    const annotation = byWord.get(word);
    if (annotation === undefined) missing.push(word);
    else annotations.push(annotation);
  }

  return { requested, annotations, missing, issues, usage: completion.usage, stopReason: completion.stopReason };
}
