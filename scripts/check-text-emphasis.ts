/**
 * Quick sanity check for bound-phrase emphasis expansion and shared styling.
 * Run: npx tsx scripts/check-text-emphasis.ts
 */
import {
  expandEmphasisToBoundPhrases,
  getBoundPhraseEmphasisSeed,
  getBoundPhraseStartIndex,
} from "../src/lib/text-language";

function emphasisStyleKey(text: string, words: string[], index: number) {
  const anchor = getBoundPhraseStartIndex(words, index);
  const seed = getBoundPhraseEmphasisSeed(words, index);
  return `${text}|${seed}|${anchor}`;
}

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

const text = words.join(" ");
const imKey = emphasisStyleKey(text, words, langIndex - 1);
const langKey = emphasisStyleKey(text, words, langIndex);
if (imKey !== langKey) {
  console.error("FAIL: im lặng should share one emphasis key:", imKey, langKey);
  process.exit(1);
}

const camXucWords = "Khi chữ hiện chậm cảm xúc dễ bám hơn.".match(/\S+/g) ?? [];
const camIndex = camXucWords.findIndex((word) => word.startsWith("cảm") || word.startsWith("cam"));
if (camIndex >= 0) {
  const camEmphasis = expandEmphasisToBoundPhrases(camXucWords, [camIndex + 1]);
  const camText = camXucWords.join(" ");
  const camKey = emphasisStyleKey(camText, camXucWords, camIndex);
  const xucKey = emphasisStyleKey(camText, camXucWords, camIndex + 1);
  if (camKey !== xucKey) {
    console.error("FAIL: cảm xúc should share one emphasis key:", camKey, xucKey);
    process.exit(1);
  }
}

console.log("OK — emphasized indexes:", [...emphasized].map((index) => words[index]).join(", "));
