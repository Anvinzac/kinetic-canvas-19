/**
 * Curated vocabulary packs for the Library page: additional decks focused on a
 * specific FIELD (business, tech, medicine…), a NEED (exam prep, interviews,
 * travel…) and a PROFICIENCY band. This is mock catalogue metadata — the packs are
 * not yet wired into the feed, so the page reads as a browsable shelf rather than a
 * working import. Counts are illustrative pool sizes, matching the difficulty ladder's
 * mock totals rather than any live catalog.
 *
 * Exports: VocabPack, VocabPackGroup, LIBRARY_GROUPS
 * Depends on: ./schema (VocabularyLevel)
 */

import type { VocabularyLevel } from "./schema";

export type VocabPack = {
  id: string;
  /** Vietnamese pack name shown on the card. */
  name: string;
  /** Short gloss of who the pack is for. */
  blurb: string;
  /** Illustrative word count for the pack. */
  words: number;
  /** CEFR band the pack targets. */
  levels: VocabularyLevel[];
  /** Free-form tags: field, need, topic emphasis. */
  tags: string[];
};

export type VocabPackGroup = {
  id: string;
  /** Section heading, e.g. "Công việc" or "Luyện thi". */
  title: string;
  /** One-line description of the shelf. */
  note: string;
  packs: VocabPack[];
};

/**
 * The shelves, ordered most-to-least aspirational: daily grounding first, then work,
 * study and travel. Levels deliberately overlap between packs so several shelves can
 * share a proficiency band without any single pack feeling empty.
 */
export const LIBRARY_GROUPS: readonly VocabPackGroup[] = [
  {
    id: "daily",
    title: "Đời sống hằng ngày",
    note: "Nền tảng giao tiếp cho những tình huống quen thuộc nhất.",
    packs: [
      {
        id: "daily-conversation",
        name: "Giao tiếp thường nhật",
        blurb: "Ăn uống, mua sắm, hỏi đường, trò chuyện xã giao.",
        words: 1600,
        levels: ["A1", "A2"],
        tags: ["giao tiếp", "chủ đề gia đình", "sở thích"],
      },
      {
        id: "home-family",
        name: "Gia đình & Nhà cửa",
        blurb: "Thành viên, việc nhà, đồ vật và thói quen sinh hoạt.",
        words: 900,
        levels: ["A1", "A2"],
        tags: ["chủ đề gia đình", "danh từ"],
      },
      {
        id: "feelings",
        name: "Cảm xúc & Tính cách",
        blurb: "Mô tả tâm trạng, tính nết và phản ứng.",
        words: 720,
        levels: ["A2", "B1"],
        tags: ["tính từ", "giao tiếp"],
      },
    ],
  },
  {
    id: "work",
    title: "Công việc",
    note: "Từ vựng cho môi trường chuyên môn, hội họp và phỏng vấn.",
    packs: [
      {
        id: "business-core",
        name: "Kinh doanh tổng quát",
        blurb: "Họp, đàm phán, báo cáo và thuật ngữ văn phòng.",
        words: 1400,
        levels: ["B1", "B2"],
        tags: ["kinh doanh", "thương mại"],
      },
      {
        id: "interview",
        name: "Phỏng vấn xin việc",
        blurb: "Cách nói về trải nghiệm, điểm mạnh và kỳ vọng.",
        words: 640,
        levels: ["B1", "B2"],
        tags: ["phỏng vấn", "giao tiếp"],
      },
      {
        id: "tech",
        name: "Công nghệ & Lập trình",
        blurb: "Thuật ngữ kỹ thuật, sản phẩm và quy trình phát triển.",
        words: 1100,
        levels: ["B2", "C1"],
        tags: ["công nghệ", "kỹ thuật"],
      },
      {
        id: "marketing",
        name: "Marketing & Truyền thông",
        blurb: "Thương hiệu, chiến dịch và số liệu tăng trưởng.",
        words: 820,
        levels: ["B2"],
        tags: ["marketing", "kinh doanh"],
      },
    ],
  },
  {
    id: "study",
    title: "Luyện thi & Học thuật",
    note: "Bám sát khung CEFR cho mục tiêu điểm số và du học.",
    packs: [
      {
        id: "ielts",
        name: "IELTS Listening & Speaking",
        blurb: "Ngôn ngữ chủ đề thi nói và nghe thường gặp.",
        words: 1500,
        levels: ["B1", "B2", "C1"],
        tags: ["luyện thi", "học thuật"],
      },
      {
        id: "toeic",
        name: "TOEIC Reading",
        blurb: "Từ vựng kinh doanh và đời sống cho phần đọc hiểu.",
        words: 1300,
        levels: ["A2", "B1", "B2"],
        tags: ["luyện thi", "kinh doanh"],
      },
      {
        id: "academic",
        name: "Tiếng Anh học thuật",
        blurb: "Văn phong luận, trích dẫn và lập luận.",
        words: 1200,
        levels: ["C1", "C2"],
        tags: ["học thuật", "viết lách"],
      },
    ],
  },
  {
    id: "travel",
    title: "Du lịch & Trải nghiệm",
    note: "Đủ dùng khi đi xa, đặt chỗ và xử lý tình huống.",
    packs: [
      {
        id: "travel-essentials",
        name: "Du lịch căn bản",
        blurb: "Sân bay, khách sạn, vận chuyển và ăn ngoài.",
        words: 980,
        levels: ["A1", "A2", "B1"],
        tags: ["du lịch", "giao tiếp"],
      },
      {
        id: "food-dining",
        name: "Ẩm thực",
        blurb: "Món ăn, hương vị, nguyên liệu và gọi món.",
        words: 760,
        levels: ["A2", "B1"],
        tags: ["ẩm thực", "du lịch"],
      },
    ],
  },
];
