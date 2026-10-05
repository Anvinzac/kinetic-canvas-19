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
  injectEmphasisMarkers,
  isVietnameseStopWord,
  stripEmphasisMarkers,
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

  test("drops a phrase that overlaps a longer one already kept", () => {
    const result = validateEmphasis({
      defVi: "Khoảng thời gian trôi qua rất nhanh.",
      emphasisVi: ["Khoảng thời gian", "thời gian"],
    });
    assert.deepEqual(result.emphasis, ["Khoảng thời gian"]);
    assert.ok(
      result.warnings.some((warning) => /overlaps the longer/.test(warning)),
      result.warnings.join(" | "),
    );
  });

  test("a longer phrase replaces the shorter one it overlaps, whatever the order", () => {
    const result = validateEmphasis({
      defVi: "Người đàn ông trưởng thành.",
      emphasisVi: ["Người đàn", "Người đàn ông"],
    });
    assert.deepEqual(result.emphasis, ["Người đàn ông"]);
    assert.ok(
      result.warnings.some((warning) => /replaces the shorter overlapping/.test(warning)),
      result.warnings.join(" | "),
    );
  });

  test("phrases in different fields never collide", () => {
    const result = validateEmphasis({
      defVi: DEF_VI,
      leadVi: "Nước là nguồn sống của mọi sinh vật.",
      emphasisVi: ["uống mỗi ngày", "nguồn sống"],
    });
    assert.deepEqual(result.emphasis, ["uống mỗi ngày", "nguồn sống"]);
    assert.deepEqual(result.warnings, []);
  });
});

describe("injectEmphasisMarkers", () => {
  test("wraps the phrase in the field where it occurs, keeping punctuation outside", () => {
    const result = injectEmphasisMarkers({ defVi: DEF_VI, leadVi: LEAD_VI, emphasis: ["uống mỗi ngày"] });
    assert.equal(result.defVi, "Chất lỏng trong suốt mà ta /uống mỗi ngày/.");
    assert.equal(result.leadVi, LEAD_VI);
    assert.deepEqual(result.marked, ["uống mỗi ngày"]);
    assert.deepEqual(result.warnings, []);
  });

  test("falls through to leadVi when the phrase only lives there", () => {
    const result = injectEmphasisMarkers({ defVi: DEF_VI, leadVi: LEAD_VI, emphasis: ["nguồn sống"] });
    assert.equal(result.defVi, DEF_VI);
    assert.equal(result.leadVi, "Nước là /nguồn sống/ của mọi sinh vật.");
  });

  test("prefers defVi when both fields contain the phrase", () => {
    const shared = { defVi: "Người bạn tốt luôn lắng nghe.", leadVi: "Một người bạn thật sự." };
    const result = injectEmphasisMarkers({ ...shared, emphasis: ["người bạn"] });
    assert.equal(result.defVi, "/Người bạn/ tốt luôn lắng nghe.");
    assert.equal(result.leadVi, shared.leadVi);
  });

  test("one marker per field: the second phrase of the same field stays unmarked", () => {
    const result = injectEmphasisMarkers({
      defVi: DEF_VI,
      leadVi: LEAD_VI,
      emphasis: ["Chất lỏng", "uống mỗi ngày", "nguồn sống"],
    });
    assert.equal(result.defVi, "/Chất lỏng/ trong suốt mà ta uống mỗi ngày.");
    assert.equal(result.leadVi, "Nước là /nguồn sống/ của mọi sinh vật.");
    assert.deepEqual(result.marked, ["Chất lỏng", "nguồn sống"]);
    assert.ok(
      result.warnings.some((warning) => /already carries a marker/.test(warning) && /uống mỗi ngày/.test(warning)),
      result.warnings.join(" | "),
    );
  });

  test("a shared phrase moves to leadVi once defVi is taken", () => {
    const shared = {
      defVi: "Người bạn tốt luôn lắng nghe.",
      leadVi: "Một người bạn thật sự quý giá.",
    };
    const result = injectEmphasisMarkers({ ...shared, emphasis: ["lắng nghe", "người bạn"] });
    assert.equal(result.defVi, "Người bạn tốt luôn /lắng nghe/.");
    assert.equal(result.leadVi, "Một /người bạn/ thật sự quý giá.");
    assert.deepEqual(result.marked, ["lắng nghe", "người bạn"]);
    assert.deepEqual(result.warnings, []);
  });

  test("keeps the casing written in the source text", () => {
    const result = injectEmphasisMarkers({ defVi: DEF_VI, leadVi: LEAD_VI, emphasis: ["chất LỎNG"] });
    assert.equal(result.defVi, "/Chất lỏng/ trong suốt mà ta uống mỗi ngày.");
  });

  test("skips a phrase that contains the delimiter", () => {
    const result = injectEmphasisMarkers({ defVi: DEF_VI, leadVi: LEAD_VI, emphasis: ["a/b"] });
    assert.equal(result.defVi, DEF_VI);
    assert.deepEqual(result.marked, []);
    assert.ok(result.warnings.some((warning) => /delimiter/.test(warning)));
  });

  test("reports a phrase that occurs in neither field instead of inventing a marker", () => {
    const result = injectEmphasisMarkers({ defVi: DEF_VI, leadVi: LEAD_VI, emphasis: ["khơng ở đâu cả"] });
    assert.equal(result.defVi, DEF_VI);
    assert.ok(result.warnings.some((warning) => /does not occur/.test(warning)));
  });

  test("stripEmphasisMarkers is the exact inverse", () => {
    const injected = injectEmphasisMarkers({
      defVi: DEF_VI,
      leadVi: LEAD_VI,
      emphasis: ["Chất lỏng", "nguồn sống"],
    });
    assert.equal(stripEmphasisMarkers(injected.defVi).clean, DEF_VI);
    assert.equal(stripEmphasisMarkers(injected.leadVi).clean, LEAD_VI);
    assert.deepEqual(stripEmphasisMarkers(injected.defVi).markers, ["Chất lỏng"]);
  });

  test("an unpaired delimiter survives stripping so validators can flag it", () => {
    const stripped = stripEmphasisMarkers("Một nửa /câu bị lệch.");
    assert.equal(stripped.clean, "Một nửa /câu bị lệch.");
    assert.deepEqual(stripped.markers, []);
  });
});
