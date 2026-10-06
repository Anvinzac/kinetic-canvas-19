/**
 * A page of four words or fewer highlights exactly one word (a compound counts as one).
 * Run: npx tsx scripts/check-emphasis-short-sentence.ts
 */
import assert from "node:assert/strict";
import { countSentenceWords, limitShortSentenceEmphasis } from "../src/lib/text-language";
import { getEmphasizedWordIndexes } from "../src/features/post-player/lib/feed-emphasis";
import { getPreviewEmphasizedWordIndexes } from "../src/features/kinetic-text/components/preview-emphasis";

const tokenize = (text: string) => text.match(/\S+/g) ?? [];
const sorted = (set: Set<number>) => [...set].sort((left, right) => left - right);
const selectors = [
  ["feed", getEmphasizedWordIndexes],
  ["preview", getPreviewEmphasizedWordIndexes],
] as const;

/** One contiguous run, at most `maxTokens` long. */
function assertSingleWord(label: string, indexes: Set<number>, maxTokens: number) {
  const list = sorted(indexes);
  assert.ok(list.length >= 1, `${label}: expected a highlight, got none`);
  assert.ok(list.length <= maxTokens, `${label}: ${list.length} tokens highlighted (${list})`);
  list.forEach((index, i) => {
    if (i) assert.equal(index, list[i - 1] + 1, `${label}: highlight is not one run (${list})`);
  });
}

// Counting ignores punctuation-only tokens.
assert.equal(countSentenceWords(tokenize("Mưa rơi — rất nhẹ…")), 4);

// The limiter itself.
assert.deepEqual(
  sorted(limitShortSentenceEmphasis(tokenize("là học sinh giỏi"), [1, 2, 3])),
  [1, 2],
);
assert.deepEqual(sorted(limitShortSentenceEmphasis(tokenize("Mưa rơi rất nhẹ"), [0, 3])), [0]);
assert.deepEqual(sorted(limitShortSentenceEmphasis(tokenize("Hãy im lặng nhé"), [1, 2])), [1, 2]);
assert.deepEqual(
  sorted(limitShortSentenceEmphasis(tokenize("Pause before every replay"), [0, 3])),
  [0],
);
assert.deepEqual(
  sorted(limitShortSentenceEmphasis(tokenize("Her smile looked completely honest."), [1, 4])),
  [1, 4],
  "five-word pages are untouched",
);
console.log("OK — limiter keeps one word on short pages, leaves longer pages alone");

// Both selectors, across every selection path.
const cases: { text: string; data?: string[]; maxTokens: number }[] = [
  { text: "Pause before every replay.", data: ["pause", "replay"], maxTokens: 1 },
  { text: "Her honest smile glowing.", maxTokens: 1 },
  { text: "Mưa rơi rất nhẹ.", data: ["mưa", "nhẹ"], maxTokens: 2 },
  { text: "Em là học sinh.", maxTokens: 2 },
  { text: "Hãy im lặng nhé.", maxTokens: 2 },
  { text: "Có quen không?", maxTokens: 2 },
];
for (const { text, data, maxTokens } of cases) {
  for (const [name, select] of selectors) {
    assertSingleWord(`${name} "${text}"`, select(tokenize(text), data), maxTokens);
  }
}
for (const [name, select] of selectors) {
  assert.deepEqual(
    sorted(select(tokenize("Hãy im lặng nhé."))),
    [1, 2],
    `${name} keeps im lặng whole`,
  );
}
console.log("OK — feed and preview highlight exactly one word on 4-word pages");
