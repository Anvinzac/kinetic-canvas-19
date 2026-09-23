/**
 * Sanity check: "khoảng" and "thở" are now separate words so they can
 * land on different lines instead of being forced as one bound phrase.
 * Run: npx tsx scripts/check-vietnamese-line-fit.ts
 */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_CANVAS } from "../src/features/canvas";
import { VietnameseLineBlock } from "../src/features/kinetic-text/components/VietnameseLineBlock";
import { entranceVariants } from "../src/features/kinetic-text/components/preview-tempo";
import { WordSequenceLines } from "../src/features/post-player/components/WordSequenceLines";
import { WordSequenceText } from "../src/features/post-player/components/WordSequenceText";
import {
  estimateSoloRevealFit,
  getMeasuredSoloWordWidth,
  getSoloRevealFit,
  SOLO_REVEAL_VISUAL_GUARD,
} from "../src/features/post-player/lib/solo-text-fit";
import { getVietnameseLayoutMetrics } from "../src/lib/text-language";

const page = "Tiếng Việt cần khoảng thở dài hơn một chút.";
const words = page.match(/\S+/g) ?? [];
const canvasWidth = 390;
const fontSize = 70;

const { lines } = getVietnameseLayoutMetrics(words, canvasWidth, fontSize);

const khoangLine = lines.find((line) =>
  line.segments.some((segment) =>
    segment.words.some((word) => word.text.toLowerCase().includes("khoảng")),
  ),
);
const thoLine = lines.find((line) =>
  line.segments.some((segment) =>
    segment.words.some((word) => word.text.toLowerCase().includes("thở")),
  ),
);

if (!khoangLine) {
  console.error("FAIL: khoảng line not found");
  process.exit(1);
}

if (!thoLine) {
  console.error("FAIL: thở line not found");
  process.exit(1);
}

const khoangText = khoangLine.segments
  .flatMap((segment) => segment.words.map((word) => word.text))
  .join(" ");
const thoText = thoLine.segments
  .flatMap((segment) => segment.words.map((word) => word.text))
  .join(" ");

const khoangPhrase = khoangText.includes("khoảng");
const thoPhrase = thoText.includes("thở");

if (!khoangPhrase || !thoPhrase) {
  console.error("FAIL: expected khoảng and thở on separate lines");
  process.exit(1);
}

console.log("OK — khoảng on line:", khoangText);
console.log("OK — thở on line:", thoText);

// A highlighted bound phrase starts after index zero, beside ordinary words.
const phraseWords = ["Có", "lúc", "im", "lặng", "là", "đủ"];
const phraseLines = [
  {
    indentEm: 0,
    segments: [
      {
        key: "before",
        words: [
          { text: "Có", index: 0 },
          { text: "lúc", index: 1 },
        ],
      },
      {
        key: "highlight",
        words: [
          { text: "im", index: 2 },
          { text: "lặng", index: 3 },
        ],
      },
      {
        key: "after",
        words: [
          { text: "là", index: 4 },
          { text: "đủ", index: 5 },
        ],
      },
    ],
  },
];
const phraseSpec = { ...DEFAULT_CANVAS, text: phraseWords.join(" "), size: 64 };
const phraseEmphasis = new Set([2, 3]);
const sharedProps = {
  spec: phraseSpec,
  words: phraseWords,
  emphasized: phraseEmphasis,
  paused: true,
  textColor: "#ffffff",
  emphasisColor: "#06FFA5",
};
const feedMarkup = renderToStaticMarkup(
  createElement(WordSequenceLines, {
    ...sharedProps,
    isVietnamese: true,
    vietnameseLines: phraseLines,
    spotlightEmphasis: true,
    staticRender: true,
    isSolo: false,
    soloInlineScale: 1,
    leftAnchoredText: true,
    entranceStyle: "rise",
  }),
);
const previewMarkup = renderToStaticMarkup(
  createElement(VietnameseLineBlock, {
    ...sharedProps,
    lines: phraseLines,
    playKey: 0,
    wordVariants: entranceVariants("slide", "stagger"),
    tempo: { duration: 0.5 },
    staticLayout: true,
  }),
);
for (const markup of [feedMarkup, previewMarkup]) {
  assert(!markup.includes("flex-basis:100%"), "Inline phrases must not consume a full line");
  assert(
    !markup.includes("justify-content:center"),
    "Inline phrases must not insert centering gaps",
  );
  assert(markup.includes("flex:0 0 auto"), "Phrase widths must stay intrinsic");
  assert(
    markup.includes('class="kinetic-emphasis-mark kinetic-emph-frame inline-flex relative"'),
    "Nonzero-index emphasis must share a frame",
  );
  assert(
    markup.includes("display:inline-flex;flex:0 0 auto;align-items:baseline;column-gap:0.24em"),
    "Shared frames need explicit flex layout and word spacing",
  );
  assert.equal((markup.match(/data-kinetic-word-index=/g) ?? []).length, phraseWords.length);
}

const untransformedText = {
  querySelector: () => ({
    offsetWidth: 1100,
    scrollWidth: 1090,
    getBoundingClientRect: () => {
      throw new Error("Never measure animated glyph bounds");
    },
  }),
} as unknown as HTMLElement;
assert.equal(getMeasuredSoloWordWidth(untransformedText), 1100);

const answers = [
  "Dawn",
  "Persistence",
  "Extraordinarily",
  "W".repeat(80),
  "self-consciousness",
  "a remarkably long answer",
];
for (const viewportWidth of [280, 320, 375, 390, 430, 768, 1440]) {
  for (const answer of answers) {
    const available = Math.min(viewportWidth * 0.85, viewportWidth - 32);
    const initial = estimateSoloRevealFit(answer, 128, viewportWidth, 1, "Inter", 900, 1.12);
    assert(initial > 0 && Number.isFinite(initial));
    // Include wide glyphs, emphasis weight and frame padding at the current font size.
    const baseWidth = (answer.length * 0.95 + 0.8) * 128 * 1.12;
    const fit = getSoloRevealFit(initial, baseWidth * initial, 160 * initial, available, 300);
    assert(
      baseWidth * fit * SOLO_REVEAL_VISUAL_GUARD <= available + 0.001,
      `${answer}: overflow at ${viewportWidth}px`,
    );
    assert(160 * fit * SOLO_REVEAL_VISUAL_GUARD <= 300.001);
    // Refit after a much wider webfont loads and a viewport shrinks.
    const changedWidth = baseWidth * 1.6;
    const refit = getSoloRevealFit(fit, changedWidth * fit, 160 * fit, available * 0.7, 200);
    assert(changedWidth * refit * SOLO_REVEAL_VISUAL_GUARD <= available * 0.7 + 0.001);
  }
}
assert(
  getSoloRevealFit(1, 10000, 100, 248, 300) < 0.03,
  "No minimum may force a long reveal to overflow",
);
assert(getSoloRevealFit(1, 80, 80, 320, 300) > 1, "Short answers retain hero sizing");
const phraseReveal = renderToStaticMarkup(
  createElement(WordSequenceText, {
    spec: { ...DEFAULT_CANVAS, text: "a remarkably long answer" },
    fitAsUnit: true,
    playKey: 0,
    paused: true,
    revealed: true,
    canvasWidth: 320,
  }),
);
assert.equal(
  (phraseReveal.match(/data-kinetic-word-index=/g) ?? []).length,
  1,
  "A multiword reveal fits as a single intact unit",
);
assert(phraseReveal.includes("a remarkably long answer"));
console.log(
  "OK — intrinsic phrase spacing, untransformed measurement, and viewport-safe reveal fitting",
);
