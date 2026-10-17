/**
 * Quick sanity check for text page-break rules.
 * Run: npx tsx scripts/check-text-pagination.ts
 */
import { paginateText } from "../src/features/post-player/lib/paginate";
import { getWords } from "../src/features/kinetic-text";

let failures = 0;

/**
 * Assert one pagination expectation.
 * @param label - human-readable case name
 * @param passed - whether the case held
 * @param pages - pages produced, printed when the case fails
 */
function check(label: string, passed: boolean, pages: string[]) {
  if (passed) {
    console.log(`PASS — ${label}`);
    return;
  }
  failures += 1;
  console.error(`FAIL — ${label}`);
  console.error(`  pages: ${JSON.stringify(pages)}`);
}

// 1. Short Vietnamese sentences stay whole — "tốc độ" must never split.
const vietnamese =
  "Trong một cuộc trò chuyện, tốc độ không phải tất cả. Có lúc câu trả lời hay nhất là im lặng.";
const vietnamesePages = paginateText(vietnamese);
check(
  "short Vietnamese sentences each stay on one page",
  vietnamesePages.length === 2 &&
    (vietnamesePages[0] ?? "").includes("tốc độ") &&
    (vietnamesePages[0] ?? "").endsWith("tất cả.") &&
    (vietnamesePages[1] ?? "").endsWith("im lặng."),
  vietnamesePages,
);

// 2. A 15-word Vietnamese sentence stays whole (the 10-word budget is soft).
const shortVietnamese = "Những buổi chiều mùa thu gió thổi nhè nhẹ qua từng con phố yên bình.";
const shortVietnamesePages = paginateText(shortVietnamese);
check(
  "15-word Vietnamese sentence stays on one page",
  shortVietnamesePages.length === 1,
  shortVietnamesePages,
);

// 3. A 25+ word Vietnamese sentence splits only at the conjunction.
const longVietnamese =
  "Buổi sáng hôm ấy trời trong xanh, gió nhẹ thổi qua khung cửa sổ, nhưng lòng người vẫn cảm thấy bình yên đến lạ thường khi nghĩ về những ngày đã qua.";
const longVietnamesePages = paginateText(longVietnamese);
check(
  "25+ word Vietnamese sentence splits only at the conjunction",
  longVietnamesePages.length === 2 &&
    (longVietnamesePages[0] ?? "").endsWith("sổ,") &&
    (longVietnamesePages[1] ?? "").startsWith("nhưng"),
  longVietnamesePages,
);

// 4. A long Vietnamese sentence with commas only never splits (no arbitrary word counts).
const commaVietnamese =
  "Anh ấy thức dậy rất sớm, pha một tách cà phê, mở cửa sổ, hít thở không khí trong lành, ngắm nhìn thành phố, chuẩn bị cho một ngày mới, rồi bắt đầu làm việc, kiên nhẫn đến tối muộn.";
const commaVietnamesePages = paginateText(commaVietnamese);
check(
  "40-word Vietnamese sentence with commas only stays whole",
  commaVietnamesePages.length === 1,
  commaVietnamesePages,
);

// 5. A 10-word English sentence stays whole (the 7-word budget is soft).
const shortEnglish = "The quiet morning light slowly fills the empty wooden room.";
const shortEnglishPages = paginateText(shortEnglish);
check(
  "10-word English sentence stays on one page",
  shortEnglishPages.length === 1,
  shortEnglishPages,
);

// 6. A long English sentence splits at a semicolon (strong clause punctuation).
const semicolonEnglish =
  "We planned the entire journey with care; the weather changed suddenly and we adapted fast to every new surprise along the way.";
const semicolonEnglishPages = paginateText(semicolonEnglish);
check(
  "22-word English sentence splits at the semicolon",
  semicolonEnglishPages.length === 2 &&
    (semicolonEnglishPages[0] ?? "").endsWith("care;") &&
    (semicolonEnglishPages[1] ?? "").startsWith("the weather"),
  semicolonEnglishPages,
);

// 7. A long English sentence with commas only stays whole (commas never split).
const commaEnglish =
  "We packed our bags, checked the map, filled the car with fuel, and drove toward the coast, singing loudly the whole way.";
const commaEnglishPages = paginateText(commaEnglish);
check(
  "22-word English sentence with commas only stays whole",
  commaEnglishPages.length === 1,
  commaEnglishPages,
);

// 8. A long English sentence splits at a spaced em-dash clause boundary.
const dashEnglish =
  "The engineers rewrote the parser from scratch — the old implementation finally stopped surprising everyone with silent failures.";
const dashEnglishPages = paginateText(dashEnglish);
check(
  "18-word English sentence splits at the em-dash",
  dashEnglishPages.length === 2 &&
    (dashEnglishPages[0] ?? "").endsWith("—") &&
    (dashEnglishPages[1] ?? "").startsWith("the old"),
  dashEnglishPages,
);

// 9. With keepPhraseEdges (the vocabulary card), a page never opens one word after a comma,
// full stop or semicolon. Without it, pages split exactly as before.
const strandedAfterComma =
  "Chiều hôm qua trời mưa rất to, sấm và chớp liên hồi khiến cả xóm phải đóng cửa ngồi trong nhà suốt mấy tiếng đồng hồ.";
const unguarded = paginateText(strandedAfterComma);
const guarded = paginateText(strandedAfterComma, { keepPhraseEdges: true });
check(
  "default paging is unchanged (splits before 'và', one word after the comma)",
  unguarded.length === 2 && (unguarded[0] ?? "").endsWith("to, sấm"),
  unguarded,
);
check(
  "keepPhraseEdges refuses the break one word after the comma",
  guarded.length === 1 && guarded[0] === strandedAfterComma,
  guarded,
);
const farFromComma =
  "Chiều hôm qua trời mưa rất to, sấm chớp liên hồi và cả xóm phải đóng cửa ngồi trong nhà suốt mấy tiếng đồng hồ liền.";
check(
  "keepPhraseEdges keeps a break that is far enough from the comma",
  JSON.stringify(paginateText(farFromComma, { keepPhraseEdges: true })) ===
    JSON.stringify(paginateText(farFromComma)),
  paginateText(farFromComma, { keepPhraseEdges: true }),
);

// ── Every page is worth a scene ───────────────────────────────────────
//
// The defect these cover: a Vietnamese deck writes typographic quotes, the page splitter
// allowed only ASCII ones after a full stop, and the closing mark became a sentence —
// and then a scene — of its own. The line layout had known about curly quotes all along;
// only the page splitter had not, because the class was re-typed at each site.
const Q = {
  ldq: "\u201C",
  rdq: "\u201D",
  lsq: "\u2018",
  rsq: "\u2019",
  laq: "\u00AB",
  raq: "\u00BB",
};
const realSyllables = (page: string) =>
  getWords(page).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;

const closingCases: [string, string][] = [
  [
    "typographic double quotes",
    `Gh\u00e9 tai b\u1ea1n th\u00e2n n\u00f3i nh\u1ecf: ${Q.ldq}\u0110\u1eebng k\u1ec3 v\u1edbi ai nh\u00e9.${Q.rdq}`,
  ],
  [
    "after a question mark",
    `${Q.ldq}M\u1eb9 \u01a1i, cho con \u0111i ch\u01a1i \u0111\u1ebfn m\u01b0\u1eddi gi\u1edd nh\u00e9?${Q.rdq}`,
  ],
  ["after an exclamation", `Xua tay lia l\u1ecba: ${Q.ldq}Th\u00f4i, th\u00f4i!${Q.rdq}`],
  ["single typographic quotes", `Anh \u1ea5y b\u1ea3o: ${Q.lsq}th\u00f4i \u0111i.${Q.rsq}`],
  [
    "guillemets",
    `B\u00e0 c\u1ee5 k\u1ec3: ${Q.laq}ng\u00e0y x\u01b0a c\u00f3 m\u1ed9t con m\u00e8o.${Q.raq}`,
  ],
  ["CJK corner brackets", "\u4ed6\u8bf4\u300C\u4e0d\u8981\u544a\u8bc9\u522b\u4eba\u300D\u3002"],
  [
    "straight quotes (unchanged)",
    `Anh \u1ea5y n\u00f3i: "\u0110\u1eebng k\u1ec3 v\u1edbi ai nh\u00e9."`,
  ],
];
for (const [label, text] of closingCases) {
  const pages = paginateText(text, { keepPhraseEdges: true });
  check(`a closing mark never becomes its own page \u2014 ${label}`, pages.length === 1, pages);
}

{
  // The same root cause, still latent: the phrase-edge detector honours `1.000`, and
  // until now the page splitter did not.
  const pages = paginateText(
    "Gi\u00e1 l\u00e0 1.000 \u0111\u1ed3ng. R\u1ebb th\u1eadt nh\u00e9 b\u1ea1n \u01a1i!",
    {
      keepPhraseEdges: true,
    },
  );
  check(
    "a decimal point does not end a sentence",
    pages.length === 2 && pages[0] === "Gi\u00e1 l\u00e0 1.000 \u0111\u1ed3ng.",
    pages,
  );
}
{
  const pages = paginateText(
    "N\u1ebfu c\u00e2y nghe nh\u1ea1c c\u00f3 l\u1edbn nhanh h\u01a1n kh\u00f4ng? Th\u1eed xem.",
  );
  check("a short trailing sentence is absorbed, not left a scene", pages.length === 1, pages);
}
{
  const pages = paginateText("Kh\u00f3 qu\u00e1? C\u1ee9 th\u1edf d\u00e0i \u0111i!");
  check("two short sentences on one line make one page", pages.length === 1, pages);
}
{
  // The floor is about a page BESIDE another page. A whole short field is a page because
  // that is all there is, and an author's own line break is never crossed.
  check(
    "a whole short text keeps its single page",
    paginateText("\u0110\u01b0\u1ee3c ch\u01b0a \u1ea1?").length === 1,
    [],
  );
  const pages = paginateText("Kh\u00f3 qu\u00e1?\nC\u1ee9 th\u1edf d\u00e0i \u0111i!");
  check(
    "an author's line break is kept even when thin",
    pages.length === 2 && realSyllables(pages[0]!) === 2,
    pages,
  );
}

if (failures > 0) {
  console.error(`${failures} pagination check(s) failed.`);
  process.exit(1);
}

console.log("OK — all pagination checks passed.");
