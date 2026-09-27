/**
 * Vietnamese emphasis validation tests — the conservative glow-phrase gate.
 *
 * The fixtures are real Vietnamese sentences; every expectation documents one
 * documented rule from src/emphasis.ts (exact occurrence, diacritic fidelity,
 * stop words, compound protection, dedupe).
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  VIETNAMESE_STOP_WORDS,
  countSyllables,
  emphasisTokenKey,
  isVietnameseStopWord,
  validateEmphasis,
} from "../src/emphasis.ts";

/** Sentence containing: a multi-syllable phrase, a compound with "lỏng" as half, and stop words. */
const DEF_VI = "Chất lỏng trong suốt mà ta uống mỗi ngày.";
/** Second sentence so leadVi-only matches can be tested. */
const LEAD_VI = "Nước là nguồn sống của mọi sinh vật.";

describe("token helpers", () => {
  test("emphasisTokenKey keeps diacritics and strips punctuation", () => {
    assert.equal(emphasisTokenKey("  Mơ, "), "mơ");
    assert.equal(emphasisTokenKey("HỌC"), "học");
    assert.equal(emphasisTokenKey("..."), "");
  });

  test("stop words preserve accents: nhưng, những, vì, về stay distinct words", () => {
    assert.ok(isVietnameseStopWord("nhưng"));
    assert.ok(isVietnameseStopWord("những"));
    assert.ok(isVietnameseStopWord("vì"));
    assert.ok(isVietnameseStopWord("về"));
    assert.ok(isVietnameseStopWord("VÀ"), "matching is case-insensitive");
    assert.ok(!isVietnameseStopWord("học"));
    assert.ok(!isVietnameseStopWord("nước"));
    assert.ok(VIETNAMESE_STOP_WORDS.has("một"));
  });

  test("countSyllables counts space-separated tokens", () => {
    assert.equal(countSyllables("học sinh"), 2);
    assert.equal(countSyllables("uống mỗi ngày"), 3);
    assert.equal(countSyllables(""), 0);
  });
});

describe("validateEmphasis", () => {
  test("keeps multi-syllable phrases found character-for-character", () => {
    const result = validateEmphasis({
      defVi: DEF_VI,
      leadVi: LEAD_VI,
      emphasisVi: ["uống mỗi ngày", "Chất lỏng"],
    });
    assert.deepEqual(result.emphasis, ["uống mỗi ngày", "Chất lỏng"]);
    assert.deepEqual(result.warnings, []);
  });

  test("finds a phrase in leadVi as well as in defVi", () => {
    const result = validateEmphasis({ defVi: DEF_VI, leadVi: LEAD_VI, emphasisVi: ["nguồn sống"] });
    assert.deepEqual(result.emphasis, ["nguồn sống"]);
    assert.deepEqual(result.warnings, []);
  });

  test("re-cases a candidate to the casing written in the source text", () => {
    const result = validateEmphasis({ defVi: DEF_VI, emphasisVi: ["chất lỏng"] });
    assert.deepEqual(result.emphasis, ["Chất lỏng"]);
    assert.ok(result.warnings.some((warning) => /re-cased/.test(warning)));
  });

  test("drops phrases that do not occur", () => {
    const result = validateEmphasis({ defVi: DEF_VI, emphasisVi: ["bầu trời"] });
    assert.deepEqual(result.emphasis, []);
    assert.ok(result.warnings.some((warning) => /does not appear/.test(warning)));
  });

  test("treats diacritics as meaningful: sông never matches sống", () => {
    const result = validateEmphasis({ defVi: LEAD_VI, emphasisVi: ["sông"] });
    assert.deepEqual(result.emphasis, []);
    assert.ok(result.warnings.some((warning) => /does not appear/.test(warning)));
  });

  test("drops phrases made only of function words", () => {
    const result = validateEmphasis({ defVi: DEF_VI, emphasisVi: ["mà ta"] });
    assert.deepEqual(result.emphasis, []);
    assert.ok(result.warnings.some((warning) => /only function words/.test(warning)));
  });

  test("rejects a single syllable that is half of a tight compound", () => {
    const result = validateEmphasis({ defVi: DEF_VI, emphasisVi: ["lỏng"] });
    assert.deepEqual(result.emphasis, []);
    assert.ok(result.warnings.some((warning) => /half of/.test(warning)));
  });

  test("rejects a single syllable at the start of a compound", () => {
    const result = validateEmphasis({ defVi: "Mơ hồ, khó hiểu.", emphasisVi: ["Mơ"] });
    assert.deepEqual(result.emphasis, []);
    assert.ok(result.warnings.some((warning) => /half of/.test(warning)));
  });

  test("keeps a lone content syllable only when no content neighbour exists, with a warning", () => {
    const result = validateEmphasis({ defVi: "Anh ấy buồn vì chuyện đó.", emphasisVi: ["buồn"] });
    assert.deepEqual(result.emphasis, ["buồn"]);
    assert.ok(result.warnings.some((warning) => /kept single syllable/.test(warning)));
  });

  test("dedupes case-insensitively and reports the duplicate", () => {
    const result = validateEmphasis({
      defVi: DEF_VI,
      emphasisVi: ["uống mỗi ngày", "UỐNG MỖI NGÀY"],
    });
    assert.deepEqual(result.emphasis, ["uống mỗi ngày"]);
    assert.ok(result.warnings.some((warning) => /duplicate/.test(warning)));
  });

  test("returns empty results for an empty candidate list", () => {
    const result = validateEmphasis({ defVi: DEF_VI, emphasisVi: [] });
    assert.deepEqual(result.emphasis, []);
    assert.deepEqual(result.warnings, []);
  });
});
