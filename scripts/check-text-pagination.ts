/**
 * Quick sanity check for text page-break rules.
 * Run: npx tsx scripts/check-text-pagination.ts
 */
import { paginateText } from "../src/components/PostCard";

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

if (failures > 0) {
  console.error(`${failures} pagination check(s) failed.`);
  process.exit(1);
}

console.log("OK — all pagination checks passed.");
