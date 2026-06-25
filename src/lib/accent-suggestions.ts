import type { CanvasSticker } from "@/lib/canvas";

export type AccentRecommendation = {
  keyword: string;
  emoji: string;
};

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "always",
  "because",
  "before",
  "between",
  "could",
  "every",
  "from",
  "have",
  "just",
  "like",
  "more",
  "need",
  "never",
  "only",
  "some",
  "that",
  "their",
  "then",
  "there",
  "this",
  "with",
  "would",
  "anh",
  "cho",
  "cua",
  "duoc",
  "khong",
  "mot",
  "nhung",
  "toi",
  "trong",
  "voi",
]);

const EMOJI_HINTS: { pattern: RegExp; emoji: string }[] = [
  { pattern: /love|heart|romance|yeu|thuong/i, emoji: "❤️" },
  { pattern: /fire|hot|burn|flame|ruc|chay/i, emoji: "🔥" },
  { pattern: /star|shine|spark|glow|sang|lap/i, emoji: "✨" },
  { pattern: /idea|mind|brain|nghi|tuong/i, emoji: "💡" },
  { pattern: /rain|storm|water|mua|song|nuoc/i, emoji: "🌧️" },
  { pattern: /moon|night|dream|dem|trang|mo/i, emoji: "🌙" },
  { pattern: /sun|morning|dawn|nang|binh/i, emoji: "☀️" },
  { pattern: /food|eat|taste|coffee|pho|mon/i, emoji: "🍜" },
  { pattern: /win|goal|sport|game|thang|dich/i, emoji: "🏆" },
  { pattern: /music|song|dance|nhac|hat/i, emoji: "🎵" },
  { pattern: /sad|cry|miss|buon|nho/i, emoji: "💧" },
  { pattern: /happy|joy|laugh|vui|cuoi/i, emoji: "😊" },
];

const FALLBACK_EMOJIS = ["✨", "🔥", "💫", "🌙", "💡", "🎯", "🌊", "🌸"];

export function getAccentKeyword(text: string, dismissedKeyword?: string | null) {
  const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) ?? [];
  const candidates = words
    .map((word) => normalizeKeyword(word))
    .filter((word) => word.length >= 3 && word !== dismissedKeyword && !STOP_WORDS.has(word));

  if (candidates.length === 0) return null;
  return candidates
    .map((word, index) => ({
      word,
      score:
        word.length + index * 0.2 + (EMOJI_HINTS.some((hint) => hint.pattern.test(word)) ? 8 : 0),
    }))
    .sort((a, b) => b.score - a.score)[0].word;
}

export async function getAccentRecommendation(
  keyword: string,
): Promise<AccentRecommendation | null> {
  const normalized = normalizeKeyword(keyword);
  if (!normalized) return null;

  return {
    keyword: normalized,
    emoji: getEmojiForKeyword(normalized),
  };
}

export function createEmojiSticker(keyword: string, emoji: string, index: number): CanvasSticker {
  return {
    ...getStickerPlacement(keyword, index),
    id: `emoji-${keyword}-${Date.now()}`,
    kind: "emoji",
    word: keyword,
    emoji,
    title: keyword,
  };
}

function getEmojiForKeyword(keyword: string) {
  return (
    EMOJI_HINTS.find((hint) => hint.pattern.test(keyword))?.emoji ??
    FALLBACK_EMOJIS[getHash(keyword) % FALLBACK_EMOJIS.length]
  );
}

function getStickerPlacement(keyword: string, index: number) {
  const hash = getHash(`${keyword}-${index}`);
  const slots = [
    { x: 72, y: 31, size: 17 },
    { x: 24, y: 38, size: 16 },
    { x: 76, y: 62, size: 18 },
    { x: 28, y: 66, size: 15 },
  ];
  return slots[hash % slots.length];
}

function normalizeKeyword(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9'-]/g, "")
    .slice(0, 50);
}

function getHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}
