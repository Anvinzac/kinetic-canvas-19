import { describe, expect, it } from "vitest";
import { resolveTarget, siteTitle } from "../target-language";
import { readVocabularyPage } from "../../api/catalog.server";

describe("resolveTarget", () => {
  it("hoa.chayla.app serves Chinese", () => expect(resolveTarget("hoa.chayla.app")).toBe("zh"));
  it("anh.chayla.app serves English", () => expect(resolveTarget("anh.chayla.app")).toBe("en"));
  it("han.chayla.app serves Korean", () => expect(resolveTarget("han.chayla.app")).toBe("ko"));
  it("nhat.chayla.app serves Japanese", () => expect(resolveTarget("nhat.chayla.app")).toBe("ja"));
  it("unknown host falls back to English", () => expect(resolveTarget("foo.lovable.app")).toBe("en"));
  it("tolerates port and case", () => expect(resolveTarget("HOA.chayla.app:8080")).toBe("zh"));
  it("missing host falls back to English", () => expect(resolveTarget(null)).toBe("en"));
  it("Chinese title is hoa.chayLá", () => expect(siteTitle("zh")).toBe("hoa.chayLá"));
});

describe("Chinese deck", () => {
  it("a hoa request returns only Chinese words", () => {
    const page = readVocabularyPage(
      { seed: "testseed01", position: 0, limit: 24, topic: "", level: "", difficulty: "" },
      "zh",
    );
    expect(page.entries.length).toBeGreaterThan(0);
    for (const e of page.entries) expect(e.word.word).toMatch(/^\p{Script=Han}+$/u);
  });
});
