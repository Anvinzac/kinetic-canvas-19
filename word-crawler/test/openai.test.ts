/**
 * OpenAI-compatible provider tests — request/response shape for Together and
 * OpenRouter, plus CLI provider resolution. Everything runs against a mocked
 * fetch: no network and no paid call.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseCliArgs, CliUsageError, type CrawlCommand } from "../src/cli-args.ts";
import { createAnnotator, resolveProvider } from "../src/cli.ts";
import {
  DEFAULT_OPENROUTER_MODEL,
  DEFAULT_TOGETHER_MODEL,
  OPENAI_COMPATIBLE_PROVIDERS,
  OpenAICompatibleBatchAnnotator,
  chatCompletionsUrl,
  extractChatContent,
} from "../src/annotate/openai.ts";
import { LlmRequestError } from "../src/annotate/transport.ts";
import { ANNOTATION_SYSTEM_PROMPT } from "../src/annotate/prompt.ts";
import type { CorpusWord } from "../src/corpus.ts";

/** A clean annotation item, the way the model should return it. */
function annotationItem(word: string): Record<string, unknown> {
  return {
    word,
    pos: "noun",
    ipa: "/ˈwɔːtər/",
    defVi: "Chất lỏng trong suốt mà ta uống mỗi ngày.",
    leadVi: "Nước là nguồn sống.",
    anticipateVi: "Thứ bạn uống khi khát.",
    usageEn: "Please drink more _____ before running.",
    usageVi: "Hãy uống thêm nước trước khi chạy.",
    topic: "health",
    emphasisVi: ["uống mỗi ngày"],
  };
}

/** One requested corpus word. */
function corpusWord(word: string): CorpusWord {
  return { word, level: "A1", pos: "noun", band: 1, source: "test", order: 0 };
}

/** A mocked chat-completions 200 response carrying a JSON array. */
function okChatResponse(
  items: unknown[],
  options: { finishReason?: string } = {},
): Response {
  return new Response(
    JSON.stringify({
      id: "cmpl_test",
      model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: JSON.stringify(items) },
          finish_reason: options.finishReason ?? "stop",
        },
      ],
      usage: { prompt_tokens: 210, completion_tokens: 380 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

/** Crawl command fixture for the provider-resolution tests. */
function crawlCommand(overrides: Partial<CrawlCommand> = {}): CrawlCommand {
  return {
    command: "crawl",
    levels: [],
    batchSize: 20,
    limit: null,
    outputPath: "out/deck.json",
    resumePath: null,
    corpusPath: null,
    provider: null,
    baseUrl: null,
    model: null,
    maxTokens: null,
    timeoutMs: null,
    temperature: null,
    deckName: null,
    deckVersion: null,
    dryRun: false,
    ...overrides,
  };
}

describe("chatCompletionsUrl", () => {
  test("appends the path exactly once", () => {
    assert.equal(
      chatCompletionsUrl("https://api.together.xyz/v1"),
      "https://api.together.xyz/v1/chat/completions",
    );
    assert.equal(
      chatCompletionsUrl("https://api.together.xyz/v1/"),
      "https://api.together.xyz/v1/chat/completions",
    );
    assert.equal(
      chatCompletionsUrl("http://localhost:8080/v1/chat/completions"),
      "http://localhost:8080/v1/chat/completions",
    );
  });
});

describe("extractChatContent", () => {
  test("returns the first choice's message content", () => {
    const payload = { choices: [{ message: { content: "hello" } }] };
    assert.equal(extractChatContent(payload), "hello");
  });

  test("rejects a response with no choices or empty content", () => {
    assert.throws(() => extractChatContent({ choices: [] }), LlmRequestError);
    assert.throws(() => extractChatContent({}), LlmRequestError);
    assert.throws(
      () => extractChatContent({ choices: [{ message: { content: "   " } }] }),
      LlmRequestError,
    );
  });

  // Measured against zai-org/GLM-5.3: an 8-word batch spent ~18,700 reasoning
  // tokens before the first character of the answer, so a tight max_tokens
  // returns finish_reason=length with empty content. The error has to name
  // that, or the reader goes looking for a broken provider.
  test("a reasoning model that burned the whole budget says so", () => {
    assert.throws(
      () =>
        extractChatContent({
          choices: [
            {
              finish_reason: "length",
              message: { role: "assistant", content: "", reasoning_content: "x".repeat(23564) },
            },
          ],
        }),
      (error: unknown) => {
        assert.ok(error instanceof LlmRequestError);
        assert.match(error.message, /finish_reason=length/u);
        assert.match(error.message, /23564 characters/u);
        assert.match(error.message, /Raise --max-tokens or lower --batch/u);
        return true;
      },
    );
  });

  test("reasoning with no answer and no length cutoff is reported distinctly", () => {
    assert.throws(
      () =>
        extractChatContent({
          choices: [{ finish_reason: "stop", message: { content: "", reasoning_content: "hmm" } }],
        }),
      (error: unknown) => {
        assert.ok(error instanceof LlmRequestError);
        assert.match(error.message, /only reasoning \(3 characters\) and no answer/u);
        return true;
      },
    );
  });

  test("a plain empty reply keeps the plain message", () => {
    assert.throws(
      () => extractChatContent({ choices: [{ finish_reason: "stop", message: { content: "" } }] }),
      (error: unknown) => {
        assert.ok(error instanceof LlmRequestError);
        assert.equal(error.message, "Chat response has no message content");
        return true;
      },
    );
  });
});

describe("OpenAICompatibleBatchAnnotator", () => {
  test("sends the verified chat-completions shape and parses a batch", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return okChatResponse([annotationItem("water")]);
    };
    const annotator = new OpenAICompatibleBatchAnnotator({
      apiKey: "test-key",
      baseUrl: OPENAI_COMPATIBLE_PROVIDERS.together!.baseUrl,
      label: "Together AI",
      fetchImpl,
      sleep: async () => {},
    });

    const result = await annotator.annotateBatch([corpusWord("water")]);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.together.xyz/v1/chat/completions");
    assert.equal(calls[0].init?.method, "POST");
    const headers = calls[0].init?.headers as Record<string, string>;
    assert.equal(headers["content-type"], "application/json");
    assert.equal(headers.authorization, "Bearer test-key");

    const body = JSON.parse(String(calls[0].init?.body)) as Record<string, unknown>;
    assert.equal(typeof body.model, "string");
    assert.equal(typeof body.max_tokens, "number");
    const messages = body.messages as Array<{ role: string; content: string }>;
    assert.deepEqual(messages.map((message) => message.role), ["system", "user"]);
    assert.equal(messages[0].content, ANNOTATION_SYSTEM_PROMPT);
    assert.match(messages[1].content, /1\. water/);

    assert.deepEqual(result.annotations.map((annotation) => annotation.word), ["water"]);
    assert.deepEqual(result.usage, { inputTokens: 210, outputTokens: 380 });
    assert.equal(result.stopReason, "stop");
  });

  test("normalizes finish_reason length into the truncation warning", async () => {
    const fetchImpl: typeof fetch = async () =>
      okChatResponse([annotationItem("water")], { finishReason: "length" });
    const annotator = new OpenAICompatibleBatchAnnotator({
      apiKey: "k",
      baseUrl: "https://api.together.xyz/v1",
      fetchImpl,
      sleep: async () => {},
    });

    const result = await annotator.annotateBatch([corpusWord("water")]);
    assert.equal(result.stopReason, "max_tokens");
    assert.ok(result.issues[0].includes("truncated"));
  });

  test("forwards temperature only when it was set", async () => {
    const bodies: string[] = [];
    const fetchImpl: typeof fetch = async (_input, init) => {
      bodies.push(String(init?.body));
      return okChatResponse([annotationItem("water")]);
    };
    const base = { apiKey: "k", baseUrl: "https://api.together.xyz/v1", fetchImpl, sleep: async () => {} };

    await new OpenAICompatibleBatchAnnotator(base).annotateBatch([corpusWord("water")]);
    await new OpenAICompatibleBatchAnnotator({ ...base, temperature: 0.2 }).annotateBatch([corpusWord("water")]);

    assert.equal(JSON.parse(bodies[0]).temperature, undefined);
    assert.equal(JSON.parse(bodies[1]).temperature, 0.2);
  });

  test("retries a transient status and aborts the crawl on a fatal one", async () => {
    let attempts = 0;
    const retryFetch: typeof fetch = async () => {
      attempts += 1;
      return attempts === 1 ? new Response("boom", { status: 500 }) : okChatResponse([annotationItem("water")]);
    };
    const annotator = new OpenAICompatibleBatchAnnotator({
      apiKey: "k",
      baseUrl: "https://api.together.xyz/v1",
      fetchImpl: retryFetch,
      sleep: async () => {},
      random: () => 1,
    });
    const result = await annotator.annotateBatch([corpusWord("water")]);
    assert.equal(attempts, 2);
    assert.equal(result.annotations.length, 1);

    const fatal = new OpenAICompatibleBatchAnnotator({
      apiKey: "bad",
      baseUrl: "https://api.together.xyz/v1",
      fetchImpl: async () => new Response("invalid key", { status: 401 }),
      sleep: async () => {},
    });
    await assert.rejects(
      () => fatal.annotateBatch([corpusWord("water")]),
      (error: unknown) => error instanceof LlmRequestError && error.status === 401 && error.fatal,
    );
  });

  test("requires a key and a base URL", () => {
    assert.throws(
      () => new OpenAICompatibleBatchAnnotator({ apiKey: "  ", baseUrl: "https://api.together.xyz/v1" }),
      LlmRequestError,
    );
    assert.throws(
      () => new OpenAICompatibleBatchAnnotator({ apiKey: "k", baseUrl: "  " }),
      LlmRequestError,
    );
  });
});

describe("CLI provider resolution", () => {
  test("anthropic stays the default and keeps its own key variable", () => {
    const resolved = resolveProvider(crawlCommand({}), {});
    assert.equal(resolved.provider, "anthropic");
    assert.ok(resolved.keyEnvVars.includes("ANTHROPIC_API_KEY"));
    assert.equal(resolved.defaultModel, "claude-haiku-4-5-20251001");
  });

  test("together and openrouter presets carry their base URL and default model", () => {
    const together = resolveProvider(crawlCommand({ provider: "together" }), {});
    assert.equal(together.baseUrl, "https://api.together.xyz/v1");
    assert.equal(together.defaultModel, DEFAULT_TOGETHER_MODEL);
    assert.ok(together.keyEnvVars.includes("TOGETHER_API_KEY"));

    const openrouter = resolveProvider(crawlCommand({ provider: "openrouter" }), {});
    assert.equal(openrouter.baseUrl, "https://openrouter.ai/api/v1");
    assert.equal(openrouter.defaultModel, DEFAULT_OPENROUTER_MODEL);
    assert.ok(openrouter.keyEnvVars.includes("OPENROUTER_API_KEY"));
  });

  test("LLM_PROVIDER and LLM_MODEL environment overrides are honoured", () => {
    const resolved = resolveProvider(crawlCommand({}), { LLM_PROVIDER: "together", LLM_MODEL: "custom/model" });
    assert.equal(resolved.provider, "together");
    assert.ok(resolved.modelEnvVars.includes("LLM_MODEL"));
    const annotator = createAnnotator(crawlCommand(), { LLM_PROVIDER: "together", LLM_MODEL: "custom/model", LLM_API_KEY: "k" }, () => {});
    assert.equal(annotator.model, "custom/model");
  });

  test("a custom OpenAI endpoint needs a base URL and a model", () => {
    assert.throws(() => resolveProvider(crawlCommand({ provider: "openai" }), {}), CliUsageError);
    assert.throws(
      () =>
        createAnnotator(
          crawlCommand({ provider: "openai", baseUrl: "http://localhost:1234/v1" }),
          { LLM_API_KEY: "k" },
          () => {},
        ),
      (error: unknown) => error instanceof CliUsageError && /needs a model/.test(error.message),
    );
  });

  test("a missing key is a usage error naming the variables to set", () => {
    assert.throws(
      () => createAnnotator(crawlCommand({ provider: "together" }), {}, () => {}),
      (error: unknown) =>
        error instanceof CliUsageError && /TOGETHER_API_KEY/.test(error.message) && /--dry-run/.test(error.message),
    );
  });

  test("crawl --provider together wires through the parsed command", () => {
    const command = parseCliArgs(["crawl", "--output", "o.json", "--provider", "together"]);
    assert.ok(command.command === "crawl");
    assert.equal(resolveProvider(command, {}).provider, "together");
  });
});
