/**
 * Vietnamese orthography tests — the syllable validator that decides whether
 * generated text is Vietnamese at all.
 *
 * The suite is weighted towards FALSE POSITIVES on purpose. Rejecting real
 * Vietnamese is the damaging failure: it would flag good content as foreign and
 * teach whoever reads the report to ignore the check. The `REAL_VIETNAMESE`
 * corpus below is therefore asserted token by token, and every hard spelling
 * the inventories could plausibly miss (ngh-, gi-, qu-, triphthongs, "khuỷu",
 * "thuở", "giuýp") is pinned individually.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  DIACRITIC_RATIO_FLOOR,
  ENGLISH_MARKER_WORDS,
  checkVietnameseText,
  diacriticRatio,
  findEnglishMarkers,
  findForeignTokens,
  hasVietnameseMark,
  isVietnameseSyllable,
  stripTones,
  vietnameseTokens,
} from "../src/vietnamese.ts";

/**
 * Real Vietnamese prose covering the spellings a syllable validator is most
 * likely to get wrong: ngh/gh/gi/qu onsets, every triphthong, the ă/â/ê/ô/ơ/ư
 * letters, and all eight codas.
 */
const REAL_VIETNAMESE = [
  "Chất lỏng trong suốt mà ta uống mỗi ngày.",
  "Nước là nguồn sống của mọi sinh vật trên Trái Đất.",
  "Người đàn ông ấy nghiêng đầu nhìn qua khung cửa sổ.",
  "Giáo viên và học sinh cùng nghiên cứu một giả thuyết mới.",
  "Mối quan hệ giữa hai quốc gia đã trở nên khăng khít.",
  "Khoảng thời gian chờ đợi khiến tôi thấy rất khó chịu.",
  "Thị trường điện thoại ở đây tăng trưởng nhanh chóng.",
  "Khái niệm này xuất hiện trong nhiều nghiên cứu khoa học.",
  "Hiện tượng tự nhiên ấy khiến các nhà khoa học ngạc nhiên.",
  "Cô ấy giữ gìn truyền thống gia đình qua từng thế hệ.",
  "Quyển sách tuyệt vời ấy nằm khuya trên bàn làm việc.",
  "Tôi nghe tiếng chuông nhà thờ ngân vang khắp phố phường.",
  "Dữ liệu được thu thập từ nhiều nguồn khác nhau.",
  "Bộ khung lý thuyết giúp ta hiểu rõ vấn đề phức tạp.",
  "Anh ấy ngụ ý rằng mọi chuyện chưa hẳn đã kết thúc.",
  "Nhận thức của con người thay đổi theo từng trải nghiệm.",
  "Cơ hội này ngẫu nhiên đến vào lúc tôi ít mong chờ nhất.",
  "Môi trường xung quanh ảnh hưởng tới sức khỏe mỗi người.",
  "Kiến thức và hiểu biết là hai thứ không hoàn toàn giống nhau.",
  "Xã hội ngày nay đòi hỏi sự linh hoạt và kiên nhẫn.",
  "Ông ngoại tôi thường kể chuyện ngày xưa vào buổi tối.",
  "Quả thật, tuy nhiên điều ấy vẫn chưa đủ thuyết phục.",
  "Yêu thương là điều quý giá nhất mà ta có thể trao đi.",
];

describe("stripTones", () => {
  test("removes tones but keeps the Vietnamese letters", () => {
    // ặ is a + breve + dot-below: only the dot goes, so ă survives.
    assert.equal(stripTones("ặ"), "ă");
    assert.equal(stripTones("ệ"), "ê");
    assert.equal(stripTones("ự"), "ư");
    assert.equal(stripTones("ợ"), "ơ");
    assert.equal(stripTones("ậ"), "â");
    assert.equal(stripTones("ố"), "ô");
    assert.equal(stripTones("đ"), "đ", "đ is a letter, not a toned d");
    assert.equal(stripTones("tiếng Việt"), "tiêng Viêt");
  });

  test("leaves untoned text alone", () => {
    assert.equal(stripTones("khung"), "khung");
    assert.equal(stripTones("water"), "water");
  });
});

describe("hasVietnameseMark", () => {
  test("true for tones and for the extra letters", () => {
    assert.ok(hasVietnameseMark("chất"));
    assert.ok(hasVietnameseMark("đi"), "đ alone is a Vietnamese letter");
    assert.ok(hasVietnameseMark("ăn"));
    assert.ok(hasVietnameseMark("thư"));
  });

  test("false for unmarked syllables, Vietnamese or not", () => {
    assert.ok(!hasVietnameseMark("trong"));
    assert.ok(!hasVietnameseMark("ta"));
    assert.ok(!hasVietnameseMark("water"));
  });
});

describe("isVietnameseSyllable: real Vietnamese is never rejected", () => {
  test("every token of the prose corpus parses", () => {
    const rejected: string[] = [];
    for (const sentence of REAL_VIETNAMESE) {
      for (const token of vietnameseTokens(sentence)) {
        if (!isVietnameseSyllable(token)) rejected.push(token);
      }
    }
    assert.deepEqual(rejected, [], "these are real Vietnamese syllables");
  });

  test("the corpus is big enough for that to mean something", () => {
    const tokens = REAL_VIETNAMESE.flatMap(vietnameseTokens);
    assert.ok(tokens.length > 200, `only ${tokens.length} tokens`);
  });

  test("hard spellings parse one by one", () => {
    const hard = [
      "nghiêng", // ngh- onset plus ng coda
      "người",
      "quyển", // qu- onset plus the yê nucleus
      "giờ", // gi- onset
      "gìn", // g- onset, not gi-
      "giết",
      "quả",
      "hoàn",
      "tuyệt", // uyê triphthong
      "nghề",
      "đẹp",
      "khuya",
      "xoong", // the oo nucleus
      "ưu",
      "ở",
      "ạ",
      "y", // y standing alone, as in "y tế"
      "khuỷu",
      "nguyễn",
      "thuở",
      "quỳnh",
      "ngoằn",
      "oanh",
      "uyên",
      "khoảnh",
      "nghịch",
      "giuýp",
      "trường",
      "rưỡi",
      "ếch",
      "ánh",
      "ướt",
    ];
    for (const syllable of hard) {
      assert.ok(isVietnameseSyllable(syllable), `${syllable} must be accepted`);
    }
  });
});

describe("isVietnameseSyllable: foreign words are rejected", () => {
  test("English words Vietnamese cannot spell", () => {
    const english = [
      "female",
      "life",
      "water",
      "people",
      "knowledge",
      "something",
      "example",
      "teacher",
      "test",
      "data",
      "concept",
      "research",
      "environment",
      "relationship",
      "opportunity",
      "framework",
      "hypothesis",
      "phenomenon",
      "arbitrary",
      "perceive",
      "whereas",
      "meaning",
      "sentence",
      "walked",
      "quietly",
      "classmates",
    ];
    for (const word of english) {
      assert.ok(!isVietnameseSyllable(word), `${word} must be rejected`);
    }
  });

  test("the letters Vietnamese does not use", () => {
    for (const word of ["file", "jazz", "wifi", "zebra"]) {
      assert.ok(!isVietnameseSyllable(word), `${word} starts with a non-Vietnamese letter`);
    }
  });

  test("digits and empty tokens are not syllables", () => {
    assert.ok(!isVietnameseSyllable("123"));
    assert.ok(!isVietnameseSyllable("a1"));
    assert.ok(!isVietnameseSyllable(""));
  });

  test("short English words that fit the pattern are NOT caught here", () => {
    // Documented limitation: "the", "man" and "can" are legal Vietnamese
    // syllable shapes, which is why findEnglishMarkers exists as well.
    assert.ok(isVietnameseSyllable("the"));
    assert.ok(isVietnameseSyllable("man"));
    assert.ok(isVietnameseSyllable("can"));
  });
});

describe("findForeignTokens", () => {
  test("clean on the whole prose corpus", () => {
    for (const sentence of REAL_VIETNAMESE) {
      assert.deepEqual(findForeignTokens(sentence), [], sentence);
    }
  });

  test("picks the foreign words out of mixed text", () => {
    assert.deepEqual(
      findForeignTokens("Người trưởng thành thuộc giới tính female trong xã hội."),
      ["female"],
    );
    assert.deepEqual(
      findForeignTokens("Đây là một computer rất powerful.").sort(),
      ["computer", "powerful"],
    );
  });

  test("ignores emphasis markers and punctuation", () => {
    assert.deepEqual(findForeignTokens("/Chất lỏng/ trong suốt, mà ta uống!"), []);
  });

  test("splits hyphenated tokens so the foreign half is caught", () => {
    assert.deepEqual(findForeignTokens("địa chỉ e-mail của tôi"), ["mail"]);
  });

  test("deduplicates, keeping first-seen order", () => {
    // "the" is a legal Vietnamese syllable shape, so only water and and fail.
    assert.deepEqual(findForeignTokens("the water and the water"), ["water", "and"]);
  });
});

describe("ENGLISH_MARKER_WORDS", () => {
  test("every entry is load-bearing: the syllable check cannot catch it alone", () => {
    const deadWeight = [...ENGLISH_MARKER_WORDS].filter((word) => !isVietnameseSyllable(word));
    assert.deepEqual(
      deadWeight,
      [],
      "these are already unspellable in Vietnamese, so listing them hides what the list is for",
    );
  });

  test("no entry is a Vietnamese word", () => {
    // Tempting additions that are real Vietnamese: than (coal / to complain),
    // them -> thêm, man -> màn, can -> căn, plus these common homographs.
    const vietnamese = [
      "than",
      "them",
      "man",
      "can",
      "ban",
      "tin",
      "ten",
      "tan",
      "cam",
      "nam",
      "hat",
      "hang",
      "long",
      "song",
      "sang",
      "chat",
      "chin",
      "to",
      "an",
      "do",
      "ra",
      "la",
      "co",
      "ta",
    ];
    for (const word of vietnamese) {
      assert.ok(
        !ENGLISH_MARKER_WORDS.has(word),
        `"${word}" is a Vietnamese word and must never be flagged as English`,
      );
    }
  });

  test("the list stays small, because the syllable check does the work", () => {
    assert.ok(
      ENGLISH_MARKER_WORDS.size <= 20,
      `${ENGLISH_MARKER_WORDS.size} entries: anything unspellable belongs to isVietnameseSyllable`,
    );
  });
});

describe("findEnglishMarkers", () => {
  test("finds English function words that pass the syllable check", () => {
    assert.deepEqual(findEnglishMarkers("Người that uống nước"), ["that"]);
    // "This" and "is" are unspellable, so the marker list only owns "the".
    assert.deepEqual(findEnglishMarkers("This is the word"), ["the"]);
    assert.deepEqual(findForeignTokens("This is the word").sort(), ["is", "this", "word"]);
  });

  test("never flags Vietnamese words that look like English ones", () => {
    // to (big), an (peace), do (because), ra (out), la (shout), co, ta, ban
    assert.deepEqual(findEnglishMarkers("Cái bàn to do ta an ra la co ban"), []);
    for (const sentence of REAL_VIETNAMESE) {
      assert.deepEqual(findEnglishMarkers(sentence), [], sentence);
    }
  });
});

describe("diacriticRatio", () => {
  test("real Vietnamese is far above the floor", () => {
    for (const sentence of REAL_VIETNAMESE) {
      assert.ok(
        diacriticRatio(sentence) >= DIACRITIC_RATIO_FLOOR,
        `${sentence} scored ${diacriticRatio(sentence)}`,
      );
    }
  });

  test("accent-stripped Vietnamese scores zero", () => {
    const stripped = "Chat long trong suot ma ta uong moi ngay";
    assert.equal(diacriticRatio(stripped), 0);
    assert.ok(diacriticRatio(stripped) < DIACRITIC_RATIO_FLOOR);
  });

  test("stripping accents also breaks some spellings outright", () => {
    // Most stripped syllables stay legal shapes, which is exactly why the
    // diacritic floor is needed — but a stripped nucleus such as uô -> uo is
    // not a Vietnamese nucleus at all, so those tokens fail the shape check
    // too. Both layers catch accent-stripped text; neither alone would.
    assert.ok(isVietnameseSyllable("chat"), "legal shape, wrong word");
    assert.ok(isVietnameseSyllable("long"));
    assert.ok(!isVietnameseSyllable("suot"), "uo is not a Vietnamese nucleus");
    assert.ok(!isVietnameseSyllable("uong"));
    assert.deepEqual(findForeignTokens("Chat long trong suot ma ta uong moi ngay"), [
      "suot",
      "uong",
    ]);
  });

  test("markers do not change the ratio, and empty text is zero", () => {
    assert.equal(
      diacriticRatio("Chất lỏng trong suốt mà ta uống mỗi ngày."),
      diacriticRatio("/Chất lỏng/ trong suốt mà ta uống mỗi ngày."),
    );
    assert.equal(diacriticRatio(""), 0);
  });
});

describe("checkVietnameseText", () => {
  test("says nothing about real Vietnamese", () => {
    for (const sentence of REAL_VIETNAMESE) {
      assert.deepEqual(checkVietnameseText("defVi", sentence), [], sentence);
    }
    assert.deepEqual(checkVietnameseText("defVi", ""), [], "an empty field is not a defect here");
  });

  test("reports foreign tokens with the field name", () => {
    const issues = checkVietnameseText("leadVi", "Thứ này là một computer rất tốt.");
    assert.equal(issues.length, 1);
    assert.match(issues[0], /^leadVi: /u);
    assert.match(issues[0], /not Vietnamese words: computer/u);
  });

  test("reports English markers separately from unspellable tokens", () => {
    const issues = checkVietnameseText("defVi", "Người trưởng thành that có female trong đó.");
    assert.ok(issues.some((issue) => issue.includes("not Vietnamese words: female")));
    assert.ok(issues.some((issue) => issue.includes("English word(s) in Vietnamese text: that")));
  });

  test("reports accent-stripped Vietnamese twice over", () => {
    const issues = checkVietnameseText("defVi", "Chat long trong suot ma ta uong moi ngay");
    assert.ok(issues.some((issue) => issue.includes("accent-stripped Vietnamese")));
    assert.ok(
      issues.some((issue) => issue.includes("not Vietnamese words: suot, uong")),
      "the two tokens whose nucleus spelling the stripping destroyed",
    );
  });

  test("a sentence with only legal-shape stripped syllables still fails the floor", () => {
    // Every syllable here keeps a legal shape once stripped ("người" would
    // not: ươi -> uoi is no nucleus), so the floor is the only thing left.
    const stripped = "Ban toi an com trong nha moi ngay";
    const issues = checkVietnameseText("defVi", stripped);
    assert.deepEqual(findForeignTokens(stripped), []);
    assert.equal(issues.length, 1, "nothing is unspellable here");
    assert.match(issues[0], /accent-stripped Vietnamese/u);
  });

  test("caps the token list so one broken field cannot flood a report", () => {
    const issues = checkVietnameseText(
      "defVi",
      "alpha bravo charlie delta echo foxtrot golf hotel india",
    );
    const listed = issues[0].split(": ").at(-1)!.split(", ");
    assert.equal(listed.length, 6);
    assert.match(issues[0], /9 token\(s\)/u);
  });
});
