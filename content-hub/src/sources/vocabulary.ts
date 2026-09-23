import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { normalizeContentKey, type ContentItem } from "../contract.ts";
import type { ProduceContext, SourceAdapter } from "./types.ts";

// ── Reference adapter ─────────────────────────────────────────────────────────
// Vocabulary WordCrawler deck — 7-page flow (leadVi > defVi > chars > usage > initial > anticipate > reveal)
// Mix & match 4 styles by topic. Payload carries style + extended fields so the
// Supabase publisher can render the full reveal without guessing.

export type Difficulty = "easy" | "medium" | "hard";
export type VocabStyle = "detective" | "speed" | "confession" | "minimal";

export interface VocabularyWord {
  word: string;
  viDefinition: string;
  difficulty?: Difficulty;
  /** Optional playful nudge shown as the 3rd hint line, in Vietnamese. */
  nudge?: string;
  // Extended WordCrawler fields (when sourced from deck)
  leadVi?: string;
  usageEn?: string;
  usageVi?: string;
  ipa?: string;
  pos?: string;
  topic?: string;
  chars?: number;
  initial?: string;
  anticipateVi?: string;
  style?: VocabStyle;
  level?: string;
}

export interface VocabularyGenerator {
  readonly name: string;
  generate(count: number): Promise<VocabularyWord[]>;
}

// ── Style mapping ───────────────────────────────────────────────────────────
// 4 variations, locked to topic for consistency. Each style keeps the two
// detection substrings ("Từ này bắt đầu bằng chữ" + "Cả từ gồm") so
// public.vocabulary_reveal_word_from_canvas() still classifies posts as vocab.
const TOPIC_STYLE: Record<string, VocabStyle> = {
  // detective: clue-hunting — communication + attention
  communication: "detective",
  attention: "detective",
  // speed: urgent 3-sec quiz — work + time
  work: "speed",
  time: "speed",
  // confession: relatable inner voice — emotion + character
  emotion: "confession",
  character: "confession",
  // minimal: poetic / aesthetic — thinking + daily
  thinking: "minimal",
  daily: "minimal",
};

function styleForTopic(topic?: string): VocabStyle {
  if (!topic) return "minimal";
  return TOPIC_STYLE[topic] ?? "minimal";
}

function buildStyleHints(word: string, letters: number, anticipateVi: string, style: VocabStyle): string[] {
  const initial = word[0]!.toUpperCase();
  switch (style) {
    case "detective":
      return [
        `Manh mối 1 — Từ này bắt đầu bằng chữ ${initial}.`,
        `Manh mối 2 — Cả từ gồm ${letters} chữ cái.`,
        anticipateVi,
      ];
    case "speed":
      return [
        `⚡ Từ này bắt đầu bằng chữ ${initial}. — nhanh!`,
        `Cả từ gồm ${letters} chữ cái — 3 giây thôi!`,
        anticipateVi,
      ];
    case "confession":
      return [
        `Nhỏ thôi: Từ này bắt đầu bằng chữ ${initial}.`,
        `Cả từ gồm ${letters} chữ cái mà sao khó nhớ quá.`,
        anticipateVi,
      ];
    case "minimal":
      return [
        `Từ này bắt đầu bằng chữ ${initial}.`,
        `Cả từ gồm ${letters} chữ cái.`,
        anticipateVi,
      ];
  }
}

export class VocabularySource implements SourceAdapter {
  readonly sourceKey = "vocabulary.en_vi";
  readonly itemType = "vocabulary";

  constructor(private readonly generator: VocabularyGenerator) {}

  async produce(count: number, ctx: ProduceContext): Promise<ContentItem[]> {
    const words = await this.generator.generate(count);
    const items: ContentItem[] = [];

    for (const w of words) {
      const word = w.word.trim();
      const letters = w.chars ?? countLetters(word);
      if (!word || letters < 2 || !w.viDefinition.trim()) {
        ctx.log.warn("skipping invalid vocabulary word", { word });
        continue;
      }
      const style = w.style ?? styleForTopic(w.topic);
      const anticipate = w.anticipateVi?.trim() || w.nudge?.trim() || "Đoán tiếp nào, bạn tìm ra chứ?";
      const hints = buildStyleHints(word, letters, anticipate, style);

      items.push({
        sourceKey: this.sourceKey,
        itemType: this.itemType,
        contentKey: normalizeContentKey(word),
        payload: {
          word,
          vi_definition: w.viDefinition.trim(),
          hints,
          difficulty: w.difficulty ?? "medium",
          // Extended WordCrawler 7-page fields (publisher renders them if present)
          leadVi: w.leadVi?.trim() || undefined,
          usageEn: w.usageEn?.trim() || undefined,
          usageVi: w.usageVi?.trim() || undefined,
          ipa: w.ipa?.trim() || undefined,
          pos: w.pos?.trim() || undefined,
          topic: w.topic?.trim() || undefined,
          level: w.level?.trim() || undefined,
          style,
          chars: letters,
          initial: word[0]!.toUpperCase(),
          anticipateVi: anticipate,
        },
      });
    }

    return items;
  }
}

function countLetters(word: string): number {
  return (word.match(/\p{L}/gu) ?? []).length;
}

// ── Deck loader ───────────────────────────────────────────────────────────
type DeckWord = {
  id: string;
  word: string;
  pos: string;
  ipa: string;
  chars: number;
  initial: string;
  leadVi: string;
  defVi: string;
  usage: { en: string; vi: string }[];
  topic: string;
  level: string;
  anticipateVi: string;
};

function loadDeck(): DeckWord[] {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const p = resolve(here, "../../data/wordcrawler-deck-mock-v0.json");
    const raw = readFileSync(p, "utf8");
    const j = JSON.parse(raw) as { words: DeckWord[] };
    if (Array.isArray(j.words) && j.words.length) return j.words;
  } catch {
    // fallback to embedded curated list below
  }
  return [];
}

function deckToVocabularyWord(d: DeckWord): VocabularyWord {
  const levelToDiff: Record<string, Difficulty> = { A2: "easy", B1: "medium", B2: "hard" };
  return {
    word: d.word,
    viDefinition: d.defVi,
    difficulty: levelToDiff[d.level] ?? "medium",
    leadVi: d.leadVi,
    usageEn: d.usage[0]?.en,
    usageVi: d.usage[0]?.vi,
    ipa: d.ipa,
    pos: d.pos,
    topic: d.topic,
    chars: d.chars,
    initial: d.initial,
    anticipateVi: d.anticipateVi,
    level: d.level,
    style: styleForTopic(d.topic),
    nudge: d.anticipateVi,
  };
}

// ── Generator 1: curated (default, no API key needed) ─────────────────────────
// Now backed by the 25-word WordCrawler deck (content-hub/data/wordcrawler-deck-mock-v0.json)
// with mix & match styles by topic. Falls back to small seed if deck missing.
const CURATED_FALLBACK: VocabularyWord[] = [
  { word: "Petrichor", viDefinition: "Mùi đất thơm dịu sau cơn mưa đầu mùa.", difficulty: "medium" },
  { word: "Serendipity", viDefinition: "Niềm vui bất ngờ khi gặp điều may mắn.", difficulty: "hard" },
  { word: "Ephemeral", viDefinition: "Thứ tồn tại rất ngắn, thoáng qua rồi tan.", difficulty: "hard" },
  { word: "Composure", viDefinition: "Sự bình tĩnh khi mọi thứ đang rối.", difficulty: "medium" },
  { word: "Glimpse", viDefinition: "Một ý nghĩ hiện ra rất nhanh rồi biến mất.", difficulty: "easy" },
  { word: "Dawn", viDefinition: "Ánh sáng dịu xuất hiện ngay trước bình minh.", difficulty: "easy" },
  { word: "Curiosity", viDefinition: "Sự tò mò khiến bạn muốn tìm hiểu thêm.", difficulty: "medium" },
  { word: "Resilience", viDefinition: "Khả năng bật dậy sau khi vấp ngã.", difficulty: "hard" },
];

export class CuratedVocabularyGenerator implements VocabularyGenerator {
  readonly name = "curated";

  async generate(count: number): Promise<VocabularyWord[]> {
    const deck = loadDeck();
    const source: VocabularyWord[] = deck.length ? deck.map(deckToVocabularyWord) : CURATED_FALLBACK;
    const shuffled = [...source].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }
}

// ── Generator 2: Claude (the always-on feed) ──────────────────────────────────
// Asks Claude for fresh words + Vietnamese definitions as strict JSON, then
// validates. Set ANTHROPIC_API_KEY and select VOCAB_GENERATOR=claude to use it.
export class ClaudeVocabularyGenerator implements VocabularyGenerator {
  readonly name = "claude";

  constructor(
    private readonly apiKey: string,
    private readonly model = "claude-haiku-4-5-20251001",
  ) {}

  async generate(count: number): Promise<VocabularyWord[]> {
    const prompt =
      `Generate ${count} interesting but learnable English vocabulary words for Vietnamese learners. ` +
      `Return ONLY a JSON array, no prose. Each element: ` +
      `{ "word": string (one English word), "viDefinition": string (a short, natural Vietnamese definition, no English), ` +
      `"difficulty": "easy"|"medium"|"hard", "nudge": string (a short playful Vietnamese hint) }. ` +
      `Avoid proper nouns and offensive words.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`);

    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = data.content?.find((c) => c.type === "text")?.text ?? "[]";
    const json = extractJsonArray(text);
    const parsed = JSON.parse(json) as VocabularyWord[];
    return parsed.filter((w) => w && typeof w.word === "string" && typeof w.viDefinition === "string");
  }
}

function extractJsonArray(text: string): string {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  return start !== -1 && end > start ? text.slice(start, end + 1) : "[]";
}
