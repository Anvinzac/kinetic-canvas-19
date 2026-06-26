/**
 * Quick sanity check for bound-phrase emphasis expansion.
 * Run: npx tsx scripts/check-text-emphasis.ts
 */
import { expandEmphasisToBoundPhrases } from "../src/lib/text-language";

const words = "Có lúc câu trả lời hay nhất là im lặng.".match(/\S+/g) ?? [];
const langIndex = words.findIndex((word) => word.startsWith("lặng") || word.startsWith("lang"));
if (langIndex < 0) {
  console.error("FAIL: could not find lặng in", words);
  process.exit(1);
}

const emphasized = expandEmphasisToBoundPhrases(words, [langIndex]);

if (!emphasized.has(langIndex - 1) || !emphasized.has(langIndex)) {
  console.error("FAIL: im lặng should both be emphasized:", [...emphasized]);
  process.exit(1);
}

console.log("OK — emphasized indexes:", [...emphasized].map((index) => words[index]).join(", "));
