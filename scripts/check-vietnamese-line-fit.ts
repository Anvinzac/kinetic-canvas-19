/**
 * Sanity check: "khoảng" and "thở" are now separate words so they can
 * land on different lines instead of being forced as one bound phrase.
 * Run: npx tsx scripts/check-vietnamese-line-fit.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
import { VOCAB_LINE_SPACING_SCALE } from "../src/features/vocabulary/lib/presets";

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

// The vocabulary card asks for 20% more line advance; every other caller of this
// renderer (post-player feed, animated comments) must keep the compact default.
// Line pitch is lineHeight + the explicit per-line margin, so both must move.
const vietnameseText = "Tiếng Việt cần khoảng thở dài hơn một chút.";
const renderVietnamese = (lineSpacingScale?: number) =>
  renderToStaticMarkup(
    createElement(WordSequenceText, {
      spec: { ...DEFAULT_CANVAS, text: vietnameseText, size: 64 },
      playKey: 0,
      paused: true,
      revealed: true,
      canvasWidth,
      lineSpacingScale,
    }),
  );
const feedSpacing = renderVietnamese();
const cardSpacing = renderVietnamese(VOCAB_LINE_SPACING_SCALE);
assert(VOCAB_LINE_SPACING_SCALE === 1.2, "the card asks for exactly 20% more line advance");
assert(
  feedSpacing.includes("line-height:1.04") && feedSpacing.includes("margin-top:0.06em"),
  "the shared feed renderer keeps its default line pitch when no scale is passed",
);
assert(
  cardSpacing.includes("line-height:1.248") && cardSpacing.includes("margin-top:0.072em"),
  "the card scales both halves of the Vietnamese line pitch by 1.2",
);
const englishSpacing = (lineSpacingScale?: number) =>
  renderToStaticMarkup(
    createElement(WordSequenceText, {
      spec: { ...DEFAULT_CANVAS, text: "self-consciousness", size: 128 },
      playKey: 0,
      paused: true,
      revealed: true,
      canvasWidth: 320,
      fitAsUnit: true,
      lineSpacingScale,
    }),
  );
assert(englishSpacing().includes("line-height:0.9"), "Latin pages keep their 0.9 default");
assert(englishSpacing(1.2).includes("line-height:1.08"), "...and take the card's 1.2");

// A reveal answer is one unbreakable span that must never be given the chance to
// break: the container is explicitly nowrap for solo pages, while ordinary
// multi-word clue pages keep wrapping.
assert(
  phraseReveal.includes("flex-wrap:nowrap"),
  "A solo reveal container is forbidden from starting a second line",
);
assert(
  !feedSpacing.includes("flex-wrap:nowrap"),
  "multi-word clue pages may still wrap onto more than one line",
);

// ── Underlines across a multi-syllable run must join, not break mid-word ─────

// A Vietnamese compound is written as separate syllables. When both are
// emphasized they are grouped into one shared frame, each word in its own box
// with a 0.24em gap, so a per-syllable underline bar reads as one line cut in
// half. Every bar drawn inside a group must therefore carry the join class.
const COMPOUNDS = [
  "im lặng",
  "khoảng cách",
  "điềm nhiên",
  "người đàn",
  "bền bỉ",
  "cẩn thận",
  "lầm bầm",
  "màn hình",
  "nhiệt huyết",
  "vẻ đẹp",
  "bối rối",
  "sáng sủa",
  "tâm huyết",
  "kỷ luật",
  "nền tảng",
  "dai dẳng",
  "chăm chỉ",
  "thẳng thắn",
  "hài lòng",
  "nóng vội",
  "mặc dù",
  "dễ dàng",
  "vui vẻ",
  "hy vọng",
  "cố gắng",
  "đương đầu",
  "làm việc",
  "kết quả",
  "nhận xét",
  "tự tin",
];

function renderRun(text: string, emphasisSize: number) {
  const runWords = text.split(" ").slice(0, emphasisSize);
  return renderToStaticMarkup(
    createElement(WordSequenceLines, {
      spec: { ...DEFAULT_CANVAS, text, size: 64 },
      words: runWords,
      emphasized: new Set(runWords.map((_, index) => index)),
      paused: true,
      textColor: "#ffffff",
      emphasisColor: "#06FFA5",
      isVietnamese: false,
      vietnameseLines: [],
      spotlightEmphasis: false,
      staticRender: false,
      isSolo: emphasisSize === 1,
      soloInlineScale: 1,
      leftAnchoredText: false,
      entranceStyle: "rise",
    }),
  );
}

let joinedBars = 0;
let splitBars = 0;
for (const compound of COMPOUNDS) {
  for (const bar of renderRun(compound, 2).match(/kinetic-emph-underline(?: is-joined)?/g) ?? []) {
    if (bar.includes("is-joined")) joinedBars += 1;
    else splitBars += 1;
  }
}
assert(joinedBars > 0, `the seeded pick exercised the underline on syllable runs (${joinedBars})`);
assert(splitBars === 0, "no underline bar inside a shared run is left broken at the gap");

// A lone syllable has nothing to join, so it must keep its own flush bar rather
// than bleeding 0.14em past both ends.
let loneJoined = 0;
let loneBars = 0;
for (const compound of COMPOUNDS) {
  for (const bar of renderRun(compound.split(" ")[0]!, 1).match(
    /kinetic-emph-underline(?: is-joined)?/g,
  ) ?? []) {
    loneBars += 1;
    if (bar.includes("is-joined")) loneJoined += 1;
  }
}
assert(loneBars > 0, `the seeded pick exercised a single-word underline (${loneBars})`);
assert(loneJoined === 0, "a single syllable never joins, so its bar stays flush");

// The two halves live in different files, so check the stylesheet still backs the
// class the renderers emit.
const emphasisCss = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const joinRule =
  emphasisCss.match(/\.kinetic-emph-underline\.is-joined::after\s*\{([^}]*)\}/)?.[1] ?? "";
assert(
  /left:\s*-0\.\d+em/.test(joinRule) && /right:\s*-0\.\d+em/.test(joinRule),
  "the join rule still bleeds the bar past both ends (half the 0.24em column gap)",
);
console.log(
  "OK — intrinsic phrase spacing, untransformed measurement, viewport-safe reveal fitting, per-caller line spacing, and joined compound underlines",
);
