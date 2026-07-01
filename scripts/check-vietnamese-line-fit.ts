/**
 * Sanity check: bound phrases like "khoảng thở" must fit after pre-layout shrink.
 * Run: npx tsx scripts/check-vietnamese-line-fit.ts
 */
import { getVietnameseLayoutMetrics } from "../src/lib/text-language";

const page =
  "Tiếng Việt cần khoảng thở dài hơn một chút.";
const words = page.match(/\S+/g) ?? [];
const canvasWidth = 390;
const fontSize = 70;

const { lines, suggestedFitScale } = getVietnameseLayoutMetrics(words, canvasWidth, fontSize);

const khoangThoLine = lines.find((line) =>
  line.segments.some((segment) =>
    segment.words.some((word) => word.text.toLowerCase().includes("khoảng")),
  ),
);

if (!khoangThoLine) {
  console.error("FAIL: khoảng thở line not found");
  process.exit(1);
}

const phraseText = khoangThoLine.segments
  .flatMap((segment) => segment.words.map((word) => word.text))
  .join(" ");
const phraseChars = [...phraseText.normalize("NFC")].length;

if (phraseChars > 8) {
  console.log(`phrase "${phraseText}" has ${phraseChars} visible chars`);
}

if (suggestedFitScale >= 1) {
  console.error("FAIL: expected pre-shrink for wide bound phrase, got scale", suggestedFitScale);
  process.exit(1);
}

console.log("OK — suggestedFitScale:", suggestedFitScale.toFixed(3));
console.log("khoảng thở line:", phraseText, `(${phraseChars} chars)`);
