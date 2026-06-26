/**
 * Quick sanity check for text page-break rules.
 * Run: npx tsx scripts/check-text-pagination.ts
 */
import { paginateText } from "../src/components/PostCard";

const vietnamese =
  "Trong một cuộc trò chuyện, tốc độ không phải tất cả. Có lúc câu trả lời hay nhất là im lặng.";

const pages = paginateText(vietnamese);
const first = pages[0] ?? "";
const second = pages[1] ?? "";

if (first.includes("tốc") && !first.includes("độ") && second.startsWith("độ")) {
  console.error("FAIL: split tốc/độ across pages:", pages);
  process.exit(1);
}

if (!first.endsWith("chuyện,") && !first.endsWith("chuyện")) {
  console.error("FAIL: first page should end at the comma clause:", pages);
  process.exit(1);
}

if (!second.includes("tốc độ")) {
  console.error("FAIL: second page should open with tốc độ:", pages);
  process.exit(1);
}

console.log("OK — pages:");
pages.forEach((page, index) => console.log(`  ${index + 1}. ${page}`));
