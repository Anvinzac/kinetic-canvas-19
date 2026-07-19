/**
 * Vocab-bot demo posts (Vietnamese clue → English answer).
 *
 * Exports: VOCAB_BOT_POSTS
 * Depends on: seed/posts/helpers, types
 */

import type { MockPost } from "../types";
import { canvas, VOCAB_BOT_ID } from "./helpers";

export const VOCAB_BOT_POSTS: MockPost[] = [
  {
    id: "70707070-7021-4721-8721-707070700021",
    author_id: VOCAB_BOT_ID,
    post_type: "text",
    canvas_html: canvas({
      text: [
        "Mùi đất thơm dịu sau cơn mưa đầu mùa.",
        "Từ này bắt đầu bằng chữ P.",
        "Cả từ gồm 9 chữ cái.",
        "Đoán tiếp nào, bạn tìm ra chứ?",
        "Petrichor",
      ].join("\n"),
      font: "Inter",
      size: 72,
      color: "#ffffff",
      weight: 800,
      letterSpacing: -0.02,
      entrance: "fade",
      loop: "float",
      tempo: "steady",
      rhythm: "smooth",
    }),
    media_urls: [],
    bg_gradient: "linear-gradient(135deg,#00B4D8,#FF006E)",
    created_at: "2026-06-20T18:08:42.902Z",
  },
  {
    id: "70707070-7022-4722-8722-707070700022",
    author_id: VOCAB_BOT_ID,
    post_type: "text",
    canvas_html: canvas({
      text: [
        "Niềm vui bất ngờ khi gặp điều may mắn.",
        "Từ này bắt đầu bằng chữ S.",
        "Cả từ gồm 11 chữ cái.",
        "Thử đoán xem, bạn tìm ra không?",
        "Serendipity",
      ].join("\n"),
      font: "Inter",
      size: 72,
      color: "#ffffff",
      weight: 800,
      letterSpacing: -0.02,
      entrance: "scale",
      loop: "pulse",
      tempo: "steady",
      rhythm: "stagger",
    }),
    media_urls: [],
    bg_gradient: "linear-gradient(135deg,#F72585,#7209B7)",
    created_at: "2026-06-21T07:00:00.191Z",
  },
  {
    id: "70707070-7023-4723-8723-707070700023",
    author_id: VOCAB_BOT_ID,
    post_type: "text",
    canvas_html: canvas({
      text: [
        "Thứ tồn tại rất ngắn, thoáng qua rồi tan.",
        "Từ này bắt đầu bằng chữ E.",
        "Cả từ gồm 9 chữ cái.",
        "Đoán tiếp đi, bạn nghĩ ra chưa?",
        "Ephemeral",
      ].join("\n"),
      font: "Inter",
      size: 72,
      color: "#ffffff",
      weight: 800,
      letterSpacing: -0.02,
      entrance: "slide",
      loop: "float",
      tempo: "steady",
      rhythm: "smooth",
    }),
    media_urls: [],
    bg_gradient: "linear-gradient(135deg,#3A86FF,#8338EC)",
    created_at: "2026-06-21T13:00:00.188Z",
  }
];
