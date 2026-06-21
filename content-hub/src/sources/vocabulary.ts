import { normalizeContentKey, type ContentItem } from "../contract.ts";
import type { ProduceContext, SourceAdapter } from "./types.ts";

// ── Reference adapter ─────────────────────────────────────────────────────────
// Shows the full shape: a generator produces raw words, the adapter normalizes
// them into the payload the app's vocabulary consumer already understands
// ({ word, vi_definition, hints[], difficulty }). Copy this file to add news,
// recipes, jobs — only the generator + payload mapping change.

export type Difficulty = "easy" | "medium" | "hard";

export interface VocabularyWord {
  word: string;
  viDefinition: string;
  difficulty?: Difficulty;
  /** Optional playful nudge shown as the 3rd hint line, in Vietnamese. */
  nudge?: string;
}

export interface VocabularyGenerator {
  readonly name: string;
  generate(count: number): Promise<VocabularyWord[]>;
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
      const letters = countLetters(word);
      if (!word || letters < 2 || !w.viDefinition.trim()) {
        ctx.log.warn("skipping invalid vocabulary word", { word });
        continue;
      }

      const hints = [
        `Từ này bắt đầu bằng chữ ${word[0]!.toUpperCase()}.`,
        `Cả từ gồm ${letters} chữ cái.`,
        w.nudge?.trim() || "Đoán tiếp nào, bạn tìm ra chứ?",
      ];

      items.push({
        sourceKey: this.sourceKey,
        itemType: this.itemType,
        contentKey: normalizeContentKey(word),
        payload: {
          word,
          vi_definition: w.viDefinition.trim(),
          hints,
          difficulty: w.difficulty ?? "medium",
        },
      });
    }

    return items;
  }
}

function countLetters(word: string): number {
  return (word.match(/\p{L}/gu) ?? []).length;
}

// ── Generator 1: curated (default, no API key needed) ─────────────────────────
// A small seed so the service runs out of the box. Repeats are deduped by the
// queue, so a finite list is fine for testing; swap to Claude for an endless feed.
const CURATED: VocabularyWord[] = [
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
    const shuffled = [...CURATED].sort(() => Math.random() - 0.5);
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
