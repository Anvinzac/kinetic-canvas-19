/**
 * Quick sanity check for bound-phrase emphasis expansion, compound-word repair,
 * shared styling, and upstream data-driven emphasis annotations.
 * Run: npx tsx scripts/check-text-emphasis.ts
 */
import {
  expandEmphasisToBoundPhrases,
  getBoundPhraseEmphasisSeed,
  getBoundPhraseStartIndex,
  getDataEmphasisWordIndexes,
  repairSplitCompoundEmphasis,
} from "../src/lib/text-language";
import { getEmphasizedWordIndexes } from "../src/features/post-player/lib/feed-emphasis";
import { getPreviewEmphasizedWordIndexes } from "../src/features/kinetic-text/components/preview-emphasis";
import { normalizeDeck } from "../src/features/vocabulary/lib/schema";

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

// Compound repair — one glowing syllable must pull in its partner syllable.
function expectIndexes(label: string, actual: number[], expected: number[]) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`FAIL: ${label} — expected [${expected}] got [${actual}]`);
    process.exit(1);
  }
}

expectIndexes(
  "học sinh pulls in học when sinh is selected",
  repairSplitCompoundEmphasis(["học", "sinh"], [1]),
  [0, 1],
);
expectIndexes(
  "học sinh pulls in sinh when học is selected",
  repairSplitCompoundEmphasis(["học", "sinh"], [0]),
  [0, 1],
);
expectIndexes(
  "stop words never extend a pair",
  repairSplitCompoundEmphasis(["học", "sinh", "và", "giỏi"], [1]),
  [0, 1],
);
expectIndexes(
  "sentence punctuation blocks a pair",
  repairSplitCompoundEmphasis(["sinh.", "Giỏi"], [0]),
  [0],
);
expectIndexes(
  "expansion stops at pairs",
  repairSplitCompoundEmphasis(["học", "sinh", "giỏi"], [0]),
  [0, 1],
);
expectIndexes(
  "both directions expand around a middle selection",
  repairSplitCompoundEmphasis(["học", "sinh", "giỏi"], [1]),
  [0, 1, 2],
);
expectIndexes(
  "nền stays a content syllable (diacritics preserved)",
  repairSplitCompoundEmphasis(["kinh", "nền"], [0]),
  [0, 1],
);
expectIndexes(
  "non-Vietnamese text is untouched",
  repairSplitCompoundEmphasis(["motion", "pause"], [0]),
  [0],
);
expectIndexes(
  "indexes are deduplicated and ascending",
  repairSplitCompoundEmphasis(["học", "sinh"], [1, 0, 1]),
  [0, 1],
);

console.log("OK — compound repair keeps likely Vietnamese pairs together");

// ── Upstream data-driven emphasis ─────────────────────────────────────────────
// Deck words may carry crawler-produced `emphasis` annotations (the crawler's
// emphasisVi converted to the deck field). They must map to exact token
// indexes, outrank scoring, and never collide across diacritics.

function expectSet(label: string, actual: Set<number>, expected: number[]) {
  expectIndexes(
    label,
    [...actual].sort((left, right) => left - right),
    expected,
  );
}

const tokenize = (text: string) => text.match(/\S+/g) ?? [];

// 1. Exact consecutive-token phrase matching, case-insensitive + punctuation-safe.
expectSet(
  "data emphasis maps a compound phrase to its token indexes",
  getDataEmphasisWordIndexes(tokenize("Sự bình tĩnh khi mọi thứ đang rối."), ["bình tĩnh"]),
  [1, 2],
);
expectSet(
  "every occurrence of the phrase matches (case + punctuation insensitive)",
  getDataEmphasisWordIndexes(tokenize("Bình tĩnh, giữ bình tĩnh nhé."), ["bình tĩnh"]),
  [0, 1, 3, 4],
);
expectSet(
  "punctuation-only annotations match nothing",
  getDataEmphasisWordIndexes(tokenize("Bình tĩnh là chìa khóa."), ["—", "…"]),
  [],
);
expectSet(
  "missing annotations match nothing",
  getDataEmphasisWordIndexes(tokenize("Bình tĩnh là chìa khóa."), undefined),
  [],
);

// 2. Diacritics are preserved — homographs never collide.
const homographWords = tokenize("Nên đọc những trang sách cũ.");
expectSet(
  "những matches only những, never Nên",
  getDataEmphasisWordIndexes(homographWords, ["những"]),
  [2],
);
expectSet(
  "nên matches Nên case-insensitively",
  getDataEmphasisWordIndexes(homographWords, ["nên"]),
  [0],
);
expectSet("nền never matches nên", getDataEmphasisWordIndexes(homographWords, ["nền"]), []);
expectSet("nhưng never matches những", getDataEmphasisWordIndexes(homographWords, ["nhưng"]), []);

// 3. Matching annotations outrank scoring in both emphasis APIs.
const preferenceWords = tokenize("Bình tĩnh là chìa khóa.");
expectSet(
  "feed emphasis prefers data matches over scoring",
  getEmphasizedWordIndexes(preferenceWords, ["bình tĩnh"]),
  [0, 1],
);
expectSet(
  "preview emphasis prefers data matches over scoring",
  getPreviewEmphasizedWordIndexes(preferenceWords, ["bình tĩnh"]),
  [0, 1],
);
const preferenceScoring = [...getEmphasizedWordIndexes(preferenceWords)].sort(
  (left, right) => left - right,
);
const preferencePreviewScoring = [...getPreviewEmphasizedWordIndexes(preferenceWords)].sort(
  (left, right) => left - right,
);
if (JSON.stringify(preferenceScoring) === JSON.stringify([0, 1])) {
  console.error("FAIL: scoring baseline unexpectedly equals the data emphasis result");
  process.exit(1);
}

// 4. Bound-phrase expansion + compound repair still defend data matches.
expectSet(
  "single-syllable annotation of a bound phrase expands to the whole phrase",
  getEmphasizedWordIndexes(tokenize("Có lúc câu trả lời hay nhất là im lặng."), ["lặng"]),
  [8, 9],
);
expectSet(
  "partial-syllable annotation heals into its compound",
  getEmphasizedWordIndexes(tokenize("Cô ấy là học sinh."), ["học"]),
  [3, 4],
);

// 5. Unmatched annotations fall back to scoring unchanged (legacy behavior).
expectSet(
  "unmatched feed annotation falls back to scoring",
  getEmphasizedWordIndexes(preferenceWords, ["hoàn toàn không có ở đây"]),
  preferenceScoring,
);
expectSet(
  "unmatched preview annotation falls back to scoring",
  getPreviewEmphasizedWordIndexes(preferenceWords, ["hoàn toàn không có ở đây"]),
  preferencePreviewScoring,
);
expectSet(
  "words without annotations keep scoring behavior",
  getEmphasizedWordIndexes(preferenceWords),
  preferenceScoring,
);
expectSet(
  "diacritic-colliding annotation never highlights the wrong token",
  getEmphasizedWordIndexes(homographWords, ["những"]),
  [2],
);

// 6. Deck schema: emphasis validation, normalization, and dedupe.
function expectJson(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(
      `FAIL: ${label} — expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`,
    );
    process.exit(1);
  }
}

const normalizedDeck = normalizeDeck({
  meta: { name: "emphasis-check" },
  words: [
    {
      id: "calm",
      word: "calm",
      defVi: "Bình tĩnh là chìa khóa.",
      emphasis: ["bình tĩnh", "Bình  tĩnh ", "chìa khóa"],
    },
    { id: "legacy", word: "vague", defVi: "Mơ hồ, thiếu rõ ràng." },
  ],
});
expectJson(
  "deck emphasis is normalized and deduplicated case-insensitively",
  normalizedDeck.words[0]?.emphasis,
  ["bình tĩnh", "chìa khóa"],
);
expectJson("legacy words keep no emphasis field", normalizedDeck.words[1]?.emphasis, undefined);

let rejected = false;
try {
  normalizeDeck({
    words: [{ id: "bad", word: "bad", defVi: "Không hợp lệ.", emphasis: ["—"] }],
  });
} catch {
  rejected = true;
}
if (!rejected) {
  console.error("FAIL: punctuation-only emphasis must fail deck validation");
  process.exit(1);
}

console.log("OK — data-driven emphasis: exact matches, diacritic safety, fallback");
