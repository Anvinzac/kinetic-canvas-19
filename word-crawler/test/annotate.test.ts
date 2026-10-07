/**
 * Annotation tests — contract validation/repair plus the Anthropic client,
 * exercised entirely against a mocked fetch (no network, no paid calls).
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  CRAWLER_ANNOTATION_FIELDS,
  blankOutTarget,
  checkVietnameseProse,
  containsTargetWord,
  countVietnameseWords,
  parseAnnotation,
  parseAnnotationList,
} from "../src/annotate/contract.ts";
import {
  ANTHROPIC_MESSAGES_URL,
  ANTHROPIC_VERSION,
  RETRYABLE_STATUSES,
  AnthropicBatchAnnotator,
  AnthropicRequestError,
  extractContentText,
  extractJsonArray,
  isRetryableStatus,
  parseRetryAfterMs,
} from "../src/annotate/anthropic.ts";
import type { BatchAnnotationResult } from "../src/annotate/anthropic.ts";
import type { CorpusWord } from "../src/corpus.ts";

/** A clean annotation item, the way the model should return it. */
function annotationItem(word: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    word,
    pos: "noun",
    ipa: "/ˈwɔːtər/",
    defVi: "Chất lỏng trong suốt mà ta uống mỗi ngày.",
    leadVi: "Nước là thứ mà mọi người cần uống mỗi ngày.",
    anticipateVi: "Thứ bạn uống khi khát.",
    usageEn: "Please drink more _____ before running.",
    usageVi: "Hãy uống thêm nước trước khi chạy.",
    topic: "health",
    emphasisVi: ["uống mỗi ngày"],
    ...overrides,
  };
}

/** One requested corpus word. */
function corpusWord(word: string, level: CorpusWord["level"] = "A1"): CorpusWord {
  return { word, level, pos: "noun", band: 1, source: "test", order: 0 };
}

/** A mocked Anthropic 200 response carrying a JSON array as its text block. */
function okResponse(
  items: unknown[],
  options: { stopReason?: string } = {},
): Response {
  return new Response(
    JSON.stringify({
      id: "msg_test",
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: JSON.stringify(items) }],
      stop_reason: options.stopReason ?? "end_turn",
      usage: { input_tokens: 120, output_tokens: 340 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

describe("Vietnamese prose checks", () => {
  test("counts Vietnamese syllables as words, ignoring markers and punctuation", () => {
    assert.equal(countVietnameseWords("Chất lỏng trong suốt mà ta uống mỗi ngày."), 9);
    assert.equal(countVietnameseWords("Chất lỏng /trong suốt/ mà ta uống mỗi ngày."), 9);
    assert.equal(countVietnameseWords(""), 0);
  });

  test("reports a definition that came in shorter than the prompt asked", () => {
    const issues = checkVietnameseProse("defVi", "Chất lỏng để uống.");
    assert.equal(issues.length, 1);
    assert.match(issues[0], /defVi: 4 words, the prompt asks for 8-11/);
  });

  test("accepts a sentence inside the 8-11 word window", () => {
    assert.deepEqual(checkVietnameseProse("defVi", "Chất lỏng trong suốt mà ta uống mỗi ngày."), []);
  });

  test("reports a teaser that dropped its noun, and passes a legal one", () => {
    const broken = checkVietnameseProse("leadVi", "Chúng ta đều cần những này mỗi ngày rất nhiều.");
    assert.ok(broken.some((issue) => /without a noun/.test(issue)), broken.join(" | "));

    const legal = checkVietnameseProse("leadVi", "Thứ này làm cây cối xanh tươi mỗi buổi sáng.");
    assert.deepEqual(legal, []);
  });

  test("an empty optional leadVi is not a prose problem", () => {
    assert.deepEqual(checkVietnameseProse("leadVi", ""), []);
  });
});

describe("annotation contract", () => {
  test("the contract is exactly the ten required fields", () => {
    assert.deepEqual([...CRAWLER_ANNOTATION_FIELDS], [
      "word",
      "pos",
      "ipa",
      "defVi",
      "leadVi",
      "anticipateVi",
      "usageEn",
      "usageVi",
      "topic",
      "emphasisVi",
    ]);
  });

  test("parses a clean item and normalizes the word", () => {
    const { annotation, issues } = parseAnnotation(annotationItem(" Water "), "water");
    assert.ok(annotation);
    assert.equal(annotation.word, "water");
    assert.equal(annotation.topic, "health");
    assert.deepEqual(annotation.emphasisVi, ["uống mỗi ngày"]);
    assert.deepEqual(issues, []);
  });

  test("empties a teaser that lost its noun instead of shipping broken Vietnamese", () => {
    const { annotation, issues } = parseAnnotation(
      annotationItem("water", { leadVi: "Chúng ta đều cần những này mỗi ngày rất nhiều." }),
      "water",
    );
    assert.ok(annotation);
    assert.equal(annotation.leadVi, "");
    assert.ok(issues.some((issue) => /^leadVi: emptied/.test(issue)), issues.join(" | "));
  });

  test("strips a model-echoed level with a warning and keeps the annotation", () => {
    const { annotation, issues } = parseAnnotation(annotationItem("water", { level: "C1" }), "water");
    assert.ok(annotation);
    assert.ok(!Object.prototype.hasOwnProperty.call(annotation, "level"));
    assert.ok(issues.some((issue) => /extra field/.test(issue) && /level/.test(issue)));
  });

  test("rejects an item describing the wrong word", () => {
    const { annotation, issues } = parseAnnotation(annotationItem("river"), "water");
    assert.equal(annotation, null);
    assert.ok(issues.some((issue) => /"river"/.test(issue) && /"water"/.test(issue)));
  });

  test("auto-blanks a usageEn sentence that leaks the target", () => {
    const { annotation, issues } = parseAnnotation(
      annotationItem("water", { usageEn: "I drink water every day." }),
      "water",
    );
    assert.equal(annotation?.usageEn, "I drink _____ every day.");
    assert.ok(issues.some((issue) => /auto-blanked/.test(issue)));
  });

  test("blanks the target even when a placeholder already exists", () => {
    const { annotation, issues } = parseAnnotation(
      annotationItem("water", { usageEn: "I drink _____ and water daily." }),
      "water",
    );
    assert.equal(annotation?.usageEn, "I drink _____ and _____ daily.");
    assert.ok(issues.some((issue) => /leaked the answer/.test(issue)));
  });

  test("empties anticipateVi when it leaks the English answer", () => {
    const { annotation, issues } = parseAnnotation(
      annotationItem("water", { anticipateVi: "Uống water mỗi ngày." }),
      "water",
    );
    assert.equal(annotation?.anticipateVi, "");
    assert.ok(issues.some((issue) => /leaked the English answer/.test(issue)));
  });

  test("rejects an item without a usable defVi", () => {
    const { annotation } = parseAnnotation(annotationItem("water", { defVi: "" }), "water");
    assert.equal(annotation, null);
  });

  test("parseAnnotationList matches one-to-one and reports extras, duplicates and gaps", () => {
    const { annotations, issues } = parseAnnotationList(
      [annotationItem("Water"), annotationItem("river"), annotationItem("mountain")],
      ["water", "river", "hill"],
    );
    assert.deepEqual([...annotations.keys()].sort(), ["river", "water"]);
    assert.ok(issues.some((issue) => /mountain/.test(issue) && /not requested/.test(issue)));
    assert.ok(issues.some((issue) => /hill/.test(issue) && /no usable annotation/.test(issue)));

    const duplicated = parseAnnotationList([annotationItem("water"), annotationItem("water")], ["water"]);
    assert.ok(duplicated.issues.some((issue) => /duplicate annotation/.test(issue)));
  });

  test("containsTargetWord respects Unicode boundaries", () => {
    assert.ok(containsTargetWord("I love art.", "art"));
    assert.ok(!containsTargetWord("This is an artist.", "art"));
    assert.ok(containsTargetWord("Nước water đây.", "water"));
    assert.ok(!containsTargetWord("waterfall", "water"));
  });

  test("blankOutTarget replaces every standalone occurrence", () => {
    const { text, replaced } = blankOutTarget("Art and art are art.", "art");
    assert.equal(text, "_____ and _____ are _____.");
    assert.equal(replaced, 3);
  });
});

describe("Anthropic text extraction", () => {
  test("extractContentText joins every text block", () => {
    const text = extractContentText({
      content: [
        { type: "text", text: "first" },
        { type: "tool_use", id: "x" },
        { type: "text", text: "second" },
      ],
    });
    assert.equal(text, "first\nsecond");
    assert.throws(() => extractContentText({ content: [] }), AnthropicRequestError);
    assert.throws(() => extractContentText({}), AnthropicRequestError);
  });

  test("extractJsonArray tolerates prose and code fences", () => {
    assert.deepEqual(extractJsonArray('Result:\n[{"a":1}]\nDone'), [{ a: 1 }]);
    assert.deepEqual(extractJsonArray("```json\n[1,2]\n```"), [1, 2]);
  });

  test("extractJsonArray ignores brackets inside strings", () => {
    assert.deepEqual(extractJsonArray('[{"note":"a [b] c"}]'), [{ note: "a [b] c" }]);
  });

  test("extractJsonArray skips earlier non-JSON bracket noise", () => {
    assert.deepEqual(extractJsonArray("I used [a tool] then: [1]"), [1]);
  });

  // Measured on Llama-3.3-70B: it intermittently closes the batch as
  // "[ {...}, {...}, ]". Two runs in three lost a whole 8-word batch to it.
  test("extractJsonArray repairs a trailing comma", () => {
    assert.deepEqual(extractJsonArray('[ {"word":"idea"}, {"word":"imply"}, ]'), [
      { word: "idea" },
      { word: "imply" },
    ]);
    assert.deepEqual(extractJsonArray('[{"a":[1,2,],"b":{"c":1,},},]'), [{ a: [1, 2], b: { c: 1 } }]);
  });

  test("the trailing-comma repair never touches a comma inside Vietnamese text", () => {
    assert.deepEqual(
      extractJsonArray('[{"defVi":"Quả thật, tuy nhiên điều ấy, vẫn chưa đủ."},]'),
      [{ defVi: "Quả thật, tuy nhiên điều ấy, vẫn chưa đủ." }],
    );
    // A comma before a bracket that is itself inside a string must survive.
    assert.deepEqual(extractJsonArray('[{"note":"a, ] b"},]'), [{ note: "a, ] b" }]);
    // And an escaped quote must not end the string early.
    assert.deepEqual(extractJsonArray('[{"note":"say \\", ] ok"},]'), [{ note: 'say ", ] ok' }]);
  });

  // A reproducible malformed reply cannot be debugged if the error throws the
  // reply away, so the excerpt is part of the contract.
  test("extractJsonArray quotes the reply it could not parse", () => {
    assert.throws(
      () => extractJsonArray("I'm sorry, I cannot produce that."),
      (error: unknown) => {
        assert.ok(error instanceof AnthropicRequestError);
        assert.match(error.message, /the reply was: I'm sorry, I cannot produce that\./u);
        return true;
      },
    );
  });

  test("extractJsonArray says so when the reply was empty", () => {
    assert.throws(
      () => extractJsonArray("   \n  "),
      (error: unknown) => {
        assert.ok(error instanceof AnthropicRequestError);
        assert.match(error.message, /the reply was empty/u);
        return true;
      },
    );
  });

  test("extractJsonArray shows both ends of a long unparseable reply", () => {
    const long = `START${"x".repeat(900)}END`;
    assert.throws(
      () => extractJsonArray(long),
      (error: unknown) => {
        assert.ok(error instanceof AnthropicRequestError);
        assert.match(error.message, /the reply started: START/u);
        assert.match(error.message, /and ended: .*END$/u);
        assert.ok(error.message.length < 600, "an excerpt, not the whole reply");
        return true;
      },
    );
  });

  test("extractJsonArray throws when no array exists", () => {
    assert.throws(() => extractJsonArray("no array here"), AnthropicRequestError);
  });
});

describe("retry policy helpers", () => {
  test("only the verified transient statuses are retryable", () => {
    assert.deepEqual([...RETRYABLE_STATUSES], [429, 500, 504, 529]);
    for (const status of RETRYABLE_STATUSES) assert.ok(isRetryableStatus(status));
    assert.ok(!isRetryableStatus(503));
    assert.ok(!isRetryableStatus(400));
    assert.ok(!isRetryableStatus(200));
  });

  test("parseRetryAfterMs understands seconds and HTTP dates", () => {
    assert.equal(parseRetryAfterMs(new Response("", { headers: { "retry-after": "2" } })), 2000);
    const date = new Date(12_000).toUTCString();
    assert.equal(parseRetryAfterMs(new Response("", { headers: { "retry-after": date } }), 0), 12_000);
    assert.equal(parseRetryAfterMs(new Response("")), null);
    assert.equal(parseRetryAfterMs(new Response("", { headers: { "retry-after": "soon" } })), null);
  });
});

describe("AnthropicBatchAnnotator", () => {
  test("sends the verified request shape and parses a batch", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return okResponse([annotationItem("water")]);
    };
    const annotator = new AnthropicBatchAnnotator({
      apiKey: "test-key",
      fetchImpl,
      sleep: async () => {},
      random: () => 1,
    });

    const result = await annotator.annotateBatch([corpusWord("water")]);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, ANTHROPIC_MESSAGES_URL);
    assert.equal(calls[0].init?.method, "POST");
    const headers = calls[0].init?.headers as Record<string, string>;
    assert.equal(headers["content-type"], "application/json");
    assert.equal(headers["x-api-key"], "test-key");
    assert.equal(headers["anthropic-version"], ANTHROPIC_VERSION);
    assert.deepEqual(result.annotations.map((annotation) => annotation.word), ["water"]);
    assert.deepEqual(result.missing, []);
    assert.deepEqual(result.usage, { inputTokens: 120, outputTokens: 340 });
  });

  test("reports words the model skipped", async () => {
    const fetchImpl: typeof fetch = async () => okResponse([annotationItem("water")]);
    const annotator = new AnthropicBatchAnnotator({ apiKey: "k", fetchImpl, sleep: async () => {} });

    const result = await annotator.annotateBatch([corpusWord("water"), corpusWord("river")]);
    assert.deepEqual(result.missing, ["river"]);
    assert.ok(result.issues.some((issue) => /river/.test(issue)));
  });

  test("flags a truncated response", async () => {
    const fetchImpl: typeof fetch = async () => okResponse([annotationItem("water")], { stopReason: "max_tokens" });
    const annotator = new AnthropicBatchAnnotator({ apiKey: "k", fetchImpl, sleep: async () => {} });

    const result = await annotator.annotateBatch([corpusWord("water")]);
    assert.equal(result.stopReason, "max_tokens");
    assert.ok(result.issues[0].includes("truncated"));
  });

  test("retries HTTP 500 with deterministic exponential backoff", async () => {
    let attempts = 0;
    const sleeps: number[] = [];
    const fetchImpl: typeof fetch = async () => {
      attempts += 1;
      return attempts === 1 ? new Response("boom", { status: 500 }) : okResponse([annotationItem("water")]);
    };
    const annotator = new AnthropicBatchAnnotator({
      apiKey: "k",
      fetchImpl,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      random: () => 1,
      baseDelayMs: 1000,
      maxAttempts: 4,
    });

    const result = await annotator.annotateBatch([corpusWord("water")]);
    assert.equal(attempts, 2);
    assert.deepEqual(sleeps, [1000]);
    assert.deepEqual(result.annotations.map((annotation) => annotation.word), ["water"]);
  });

  test("honors retry-after over the backoff", async () => {
    let attempts = 0;
    const sleeps: number[] = [];
    const fetchImpl: typeof fetch = async () => {
      attempts += 1;
      return attempts === 1
        ? new Response("slow down", { status: 429, headers: { "retry-after": "3" } })
        : okResponse([annotationItem("water")]);
    };
    const annotator = new AnthropicBatchAnnotator({
      apiKey: "k",
      fetchImpl,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      random: () => 0,
    });

    await annotator.annotateBatch([corpusWord("water")]);
    assert.deepEqual(sleeps, [3000]);
  });

  test("does not retry a non-transient status", async () => {
    let attempts = 0;
    const fetchImpl: typeof fetch = async () => {
      attempts += 1;
      return new Response("unavailable", { status: 503 });
    };
    const annotator = new AnthropicBatchAnnotator({ apiKey: "k", fetchImpl, sleep: async () => {} });

    await assert.rejects(
      () => annotator.annotateBatch([corpusWord("water")]),
      (error: unknown) => error instanceof AnthropicRequestError && error.status === 503 && !error.fatal,
    );
    assert.equal(attempts, 1);
  });

  test("stops after the bounded number of attempts", async () => {
    let attempts = 0;
    const sleeps: number[] = [];
    const fetchImpl: typeof fetch = async () => {
      attempts += 1;
      return new Response("boom", { status: 500 });
    };
    const annotator = new AnthropicBatchAnnotator({
      apiKey: "k",
      fetchImpl,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      random: () => 0,
      baseDelayMs: 1000,
      maxAttempts: 2,
    });

    await assert.rejects(
      () => annotator.annotateBatch([corpusWord("water")]),
      (error: unknown) => error instanceof AnthropicRequestError && error.status === 500,
    );
    assert.equal(attempts, 2);
    assert.deepEqual(sleeps, [500]);
  });

  test("fails fast on a fatal status", async () => {
    let attempts = 0;
    const fetchImpl: typeof fetch = async () => {
      attempts += 1;
      return new Response("invalid key", { status: 401 });
    };
    const annotator = new AnthropicBatchAnnotator({ apiKey: "bad", fetchImpl, sleep: async () => {} });

    await assert.rejects(
      () => annotator.annotateBatch([corpusWord("water")]),
      (error: unknown) => error instanceof AnthropicRequestError && error.status === 401 && error.fatal,
    );
    assert.equal(attempts, 1);
  });

  test("retries transport errors that have no status", async () => {
    let attempts = 0;
    const fetchImpl: typeof fetch = async () => {
      attempts += 1;
      if (attempts === 1) throw new TypeError("fetch failed");
      return okResponse([annotationItem("water")]);
    };
    const annotator = new AnthropicBatchAnnotator({ apiKey: "k", fetchImpl, sleep: async () => {}, random: () => 1 });

    const result = await annotator.annotateBatch([corpusWord("water")]);
    assert.equal(attempts, 2);
    assert.equal(result.annotations.length, 1);
  });

  test("requires an API key", () => {
    assert.throws(() => new AnthropicBatchAnnotator({ apiKey: "  " }), AnthropicRequestError);
  });

  test("skips an empty batch without calling the network", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return okResponse([]);
    };
    const annotator = new AnthropicBatchAnnotator({ apiKey: "k", fetchImpl, sleep: async () => {} });

    const result: BatchAnnotationResult = await annotator.annotateBatch([]);
    assert.equal(calls, 0);
    assert.deepEqual(result.missing, []);
    assert.deepEqual(result.issues, ["empty batch skipped"]);
  });
});
