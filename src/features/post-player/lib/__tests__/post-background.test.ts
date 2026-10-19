import { describe, expect, it } from "vitest";
import { isBackdropJump } from "../post-background";

describe("isBackdropJump", () => {
  it("glides a one-page turn either way", () => {
    expect(isBackdropJump(2, 3)).toBe(false);
    expect(isBackdropJump(3, 2)).toBe(false);
  });
  it("cuts the reveal jump from the first clue", () => expect(isBackdropJump(0, 5)).toBe(true));
  it("cuts a replay from the spelling coda back to the start", () =>
    expect(isBackdropJump(6, 0)).toBe(true));
});
