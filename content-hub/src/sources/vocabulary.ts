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
  /** Optional crawler-produced Vietnamese emphasis phrases (deck field `emphasis`). */
  emphasis?: string[];
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

function buildStyleHints(
  word: string,
  letters: number,
  anticipateVi: string,
  style: VocabStyle,
): string[] {
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
      return [`Từ này bắt đầu bằng chữ ${initial}.`, `Cả từ gồm ${letters} chữ cái.`, anticipateVi];
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
      const anticipate =
        w.anticipateVi?.trim() || w.nudge?.trim() || "Đoán tiếp nào, bạn tìm ra chứ?";
      const hints = buildStyleHints(word, letters, anticipate, style);
      const emphasis = sanitizeEmphasisPhrases(w.emphasis, [
        w.viDefinition,
        w.leadVi,
        w.usageVi,
        w.anticipateVi,
        w.nudge,
      ]);

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
          // Validated crawler/generator emphasis annotations (undefined when none survive)
          emphasis,
        },
      });
    }

    return items;
  }
}

// ── Emphasis annotation validation ─────────────────────────────────────────────
// Deck field `emphasis` carries crawler-produced Vietnamese emphasis phrases
// (converted from the crawler's internal emphasisVi). The Hub validates them
// conservatively before payload assembly without importing main-app code: the
// token comparison re-uses the app's compound-key concept — NFC-normalized,
// lowercased, punctuation-stripped keys that KEEP diacritics, so "những" never
// stands in for "nhưng". Compound healing (a partial-syllable annotation
// glowing beside its partner syllable) stays in the renderer's
// repairSplitCompoundEmphasis guard, which also runs for data matches.
const EMPHASIS_MAX_PHRASES = 6;
const EMPHASIS_MAX_TOKENS = 6;
const EMPHASIS_MAX_CHARS = 80;

function emphasisTokenKey(token: string): string {
  return token
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

/** Tokenize one annotation phrase into comparison keys, or null when unusable. */
function emphasisPhraseKeys(phrase: string): string[] | null {
  const tokens = phrase.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length || tokens.length > EMPHASIS_MAX_TOKENS) return null;
  const keys = tokens.map(emphasisTokenKey);
  // Punctuation-only tokens ("—", "…") cannot anchor a meaningful emphasis match.
  if (keys.some((key) => key.length === 0)) return null;
  return keys;
}

/**
 * Keep only meaningful emphasis phrases that actually occur as consecutive
 * tokens in one of the word's Vietnamese texts.
 * @param emphasis raw annotations (deck or generator output)
 * @param vietnameseTexts Vietnamese source fields the annotations may come from
 * @returns Validated deduplicated phrases, or undefined when none survive
 */
function sanitizeEmphasisPhrases(
  emphasis: string[] | undefined,
  vietnameseTexts: Array<string | undefined>,
): string[] | undefined {
  if (!emphasis?.length) return undefined;
  const haystacks = vietnameseTexts
    .filter((text): text is string => !!text && text.trim().length > 0)
    .map((text) => text.split(/\s+/).map(emphasisTokenKey));

  const kept: string[] = [];
  const seen = new Set<string>();
  for (const raw of emphasis) {
    if (kept.length >= EMPHASIS_MAX_PHRASES) break;
    const phrase = raw.normalize("NFC").trim().replace(/\s+/g, " ");
    if (!phrase || phrase.length > EMPHASIS_MAX_CHARS) continue;
    const keys = emphasisPhraseKeys(phrase);
    if (!keys) continue;
    const occurs = haystacks.some((hay) =>
      hay.some(
        (_, start) =>
          start + keys.length <= hay.length &&
          keys.every((key, offset) => hay[start + offset] === key),
      ),
    );
    if (!occurs) continue;
    const dedupeKey = keys.join(" ");
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    kept.push(phrase);
  }
  return kept.length ? kept : undefined;
}

/**
 * Strip inline `/phrase/` emphasis markers from one text field.
 * Unpaired slashes are left untouched — a half marker is content, not markup.
 * @param text deck field, possibly carrying markers
 * @returns marker-free text plus the phrases that were wrapped
 */
function stripEmphasisMarkers(text: string | undefined): { clean: string; markers: string[] } {
  if (!text) return { clean: "", markers: [] };
  const markers: string[] = [];
  const clean = text.replace(/\/([^/]+)\//g, (_match, phrase: string) => {
    const trimmed = phrase.trim();
    if (trimmed) markers.push(trimmed);
    return trimmed;
  });
  return { clean, markers };
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
  /** Optional crawler-produced Vietnamese emphasis phrases. */
  emphasis?: string[];
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
  // A crawler deck marks emphasis inline ("/người đàn ông/") because that is the
  // format the feed's own stage parser reads. Bot posts are plain text, so the
  // markers are stripped here and the marked phrases are folded into `emphasis`.
  const defVi = stripEmphasisMarkers(d.defVi);
  const leadVi = stripEmphasisMarkers(d.leadVi);
  const usageEn = stripEmphasisMarkers(d.usage[0]?.en);
  const usageVi = stripEmphasisMarkers(d.usage[0]?.vi);
  const anticipateVi = stripEmphasisMarkers(d.anticipateVi);
  const emphasis = [
    ...new Set([...defVi.markers, ...leadVi.markers, ...usageEn.markers, ...(d.emphasis ?? [])]),
  ];
  return {
    word: d.word,
    viDefinition: defVi.clean,
    difficulty: levelToDiff[d.level] ?? "medium",
    leadVi: leadVi.clean,
    usageEn: usageEn.clean || undefined,
    usageVi: usageVi.clean || undefined,
    ipa: d.ipa,
    pos: d.pos,
    topic: d.topic,
    chars: d.chars,
    initial: d.initial,
    anticipateVi: anticipateVi.clean,
    level: d.level,
    style: styleForTopic(d.topic),
    nudge: anticipateVi.clean,
    emphasis: emphasis.length ? emphasis : undefined,
  };
}

// ── Generator 1: curated (default, no API key needed) ─────────────────────────
// Now backed by the 25-word WordCrawler deck (content-hub/data/wordcrawler-deck-mock-v0.json)
// with mix & match styles by topic. Falls back to small seed if deck missing.
const CURATED_FALLBACK: VocabularyWord[] = [
  {
    word: "Petrichor",
    viDefinition: "Mùi đất thơm dịu sau cơn mưa đầu mùa.",
    difficulty: "medium",
  },
  {
    word: "Serendipity",
    viDefinition: "Niềm vui bất ngờ khi gặp điều may mắn.",
    difficulty: "hard",
  },
  {
    word: "Ephemeral",
    viDefinition: "Thứ tồn tại rất ngắn, thoáng qua rồi tan.",
    difficulty: "hard",
  },
  { word: "Composure", viDefinition: "Sự bình tĩnh khi mọi thứ đang rối.", difficulty: "medium" },
  {
    word: "Glimpse",
    viDefinition: "Một ý nghĩ hiện ra rất nhanh rồi biến mất.",
    difficulty: "easy",
  },
  {
    word: "Dawn",
    viDefinition: "Ánh sáng dịu xuất hiện ngay trước bình minh.",
    difficulty: "easy",
  },
  {
    word: "Curiosity",
    viDefinition: "Sự tò mò khiến bạn muốn tìm hiểu thêm.",
    difficulty: "medium",
  },
  { word: "Resilience", viDefinition: "Khả năng bật dậy sau khi vấp ngã.", difficulty: "hard" },
];

export class CuratedVocabularyGenerator implements VocabularyGenerator {
  readonly name = "curated";

  async generate(count: number): Promise<VocabularyWord[]> {
    const deck = loadDeck();
    const source: VocabularyWord[] = deck.length
      ? deck.map(deckToVocabularyWord)
      : CURATED_FALLBACK;
    const shuffled = [...source].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }
}

// ── Generator 2: Claude (the always-on feed) ──────────────────────────────────
// Asks Claude for fresh words + full Vietnamese annotations as strict JSON,
// then validates. Set ANTHROPIC_API_KEY and select VOCAB_GENERATOR=claude.
//
// Prompt design mirrors the word-crawler's proven ANNOTATION_SYSTEM_PROMPT
// (word-crawler/src/annotate/prompt.ts) but adapted for generative mode:
// the model picks its own words instead of annotating a given list.

/**
 * System prompt — field rules, negative prompts, quality bar.
 * Output schema matches the word-crawler contract so downstream mapping is trivial.
 */
const CLAUDE_VOCAB_SYSTEM_PROMPT = `You are a vocabulary curriculum designer for a mobile "learn one English word at a time" app targeting Vietnamese learners. The reader sees Vietnamese hints first and only later the English word, so the Vietnamese text must be engaging on its own.

For each word requested, return exactly one JSON object with these 10 fields and no others:
word, pos, ipa, defVi, leadVi, anticipateVi, usageEn, usageVi, topic, emphasisVi

── Field rules ─────────────────────────────────────────────────────────────────

"word": a single English headword, 4–12 letters, lowercase.
  ✗ No phrases ("in spite of"), no hyphens, no proper nouns ("Shakespeare").
  ✗ No trivially easy words ("cat", "dog", "book", "good", "big", "go", "is").
  ✗ No offensive, vulgar, or culturally sensitive words.
  ✗ No technical jargon ("photosynthesis", "mitochondria").
  ✗ No archaic or literary words unlikely to appear in conversation ("thou", "betwixt").
  ✗ No compound phrases longer than one word.
  ✓ Prefer concrete, vivid words that evoke a scene or feeling.

"pos": exactly one of: noun, verb, adj, adv.
  ✗ No "prep", "conj", "phrase" — the app only teaches these four parts of speech.

"ipa": IPA transcription between forward slashes, e.g. "/rɪˈzɪl.i.ənt/".
  ✗ No phonetic respelling like "ri-ZIL-ee-ent".
  ✗ No plain pronunciation like "re-zi-lent".
  ✓ Use standard IPA symbols only: stress marks ˈ ˌ, length ː, schwa ə, etc.

"defVi": ONE Vietnamese sentence defining the word. 8–11 words, max 140 characters.
  ✗ Never include the English target word or any English word.
  ✗ Never wrap any word in quotes or parentheses.
  ✗ Never write a circular definition ("X means the act of X-ing").
  ✗ Never add an English translation in parentheses.
  ✓ Be concise and natural, like a Vietnamese teacher explaining to a student.

"leadVi": a Vietnamese teaser that hints at the meaning WITHOUT naming it directly. 8–11 words, max 120 characters.
  ✗ Never include the English target word or any English word.
  ✗ Never give away the answer — do not restate the definition.
  ✗ Never be a copy of defVi reworded.
  ✓ Be evocative and poetic, like a riddle. Use ellipsis (…) for dramatic pause.
  ✓ Create curiosity that makes the learner want to see the word.
  Example style: "Bị nhấn xuống rồi… bật lên lại." (for "resilient")

"anticipateVi": a very short playful Vietnamese nudge. 3–8 words, max 40 characters.
  ✗ Never include the English target word or any English word.
  ✗ Never be a plain statement ("Từ này nghĩa là…").
  ✓ Be fun and inviting: "Đoán xem nào…", "Sắp mở rồi đó.", "Ba… hai… một…"

"usageEn": ONE natural English sentence using the word. Max 20 words.
  ✗ Replace the target word with exactly five underscores: _____
  ✗ Never include the target word in any form.
  ✓ The sentence should feel like something a real person would say.

"usageVi": the Vietnamese translation of the usage example. Max 140 characters.
  ✗ No English words at all — pure Vietnamese.
  ✓ Sound natural, not a word-by-word translation.

"topic": one lowercase tag from this exact list:
  communication, attention, work, time, emotion, character, thinking, daily

"emphasisVi": 2 to 4 Vietnamese phrases that will glow on screen for visual emphasis.
  Each phrase MUST be copied EXACTLY, diacritics included, from the defVi or leadVi you wrote.
  ✗ Never a single syllable of a longer compound word ("hiệp" alone from "thỏa hiệp").
  ✗ Never a function word (và, là, của, có, được, trong, cho, với, một, rất, cũng, đã, đang, sẽ, không, những, các, thì, mà).
  ✗ Never longer than 30 characters or 3 syllables.
  ✓ A meaningful unit: noun phrase, verb phrase, or adjective + noun.
  ✓ Unique within the list — no duplicates.

── Hard rules ──────────────────────────────────────────────────────────────────

1. Write correct Vietnamese with full diacritics in ALL Vietnamese fields.
2. Never include the English target word (or any English word) in defVi, leadVi, anticipateVi, or usageVi.
3. No word may appear twice in the same batch.
4. Distribute difficulty roughly: ~25% easy everyday words (A2), ~50% intermediate (B1), ~25% challenging (B2).
5. Spread topics — do not put 3+ consecutive words in the same topic.
6. Return ONLY a JSON array with one object per word. No markdown fences, no headings, no commentary, no prose before or after the array.

── Example (one word, shortened) ──────────────────────────────────────────────

[{"word":"negotiate","pos":"verb","ipa":"/nɪˈɡoʊ.ʃi.eɪt/","defVi":"Thương lượng để đạt thỏa thuận.","leadVi":"Hai bên ngồi lại, mỗi bên nhường một chút.","anticipateVi":"Sắp mở rồi đó.","usageEn":"We need to _____ a better price.","usageVi":"Chúng ta cần thương lượng giá tốt hơn.","topic":"work","emphasisVi":["Thương lượng","thỏa thuận"]}]`;

/** Build the user message requesting a specific number of words. */
function buildClauedVocabUserPrompt(count: number): string {
  return [
    `Generate ${count} English vocabulary words for Vietnamese learners.`,
    "Pick words that are useful in everyday conversation, work, and relationships.",
    "Mix topics and difficulty levels.",
    "",
    `Return the JSON array with exactly ${count} objects.`,
  ].join("\n");
}

export class ClaudeVocabularyGenerator implements VocabularyGenerator {
  readonly name = "claude";

  constructor(
    private readonly apiKey: string,
    private readonly model = "claude-haiku-4-5-20251001",
  ) {}

  async generate(count: number): Promise<VocabularyWord[]> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        system: CLAUDE_VOCAB_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildClauedVocabUserPrompt(count) }],
      }),
    });

    if (!res.ok)
      throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`);

    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = data.content?.find((c) => c.type === "text")?.text ?? "[]";
    const json = extractJsonArray(text);
    const parsed = JSON.parse(json) as Array<Record<string, unknown>>;

    // Map crawler-contract field names → VocabularyWord field names,
    // validate required fields, drop unusable entries.
    const levelToDiff: Record<string, Difficulty> = {
      easy: "easy",
      medium: "medium",
      hard: "hard",
    };
    return parsed
      .filter((w) => w && typeof w.word === "string" && typeof w.defVi === "string")
      .map((w) => {
        const word = (w.word as string).trim();
        const emphasis = Array.isArray(w.emphasisVi)
          ? w.emphasisVi.filter((p): p is string => typeof p === "string")
          : undefined;
        return {
          word,
          viDefinition: (w.defVi as string).trim(),
          difficulty: levelToDiff[String(w.difficulty ?? "medium")] ?? "medium",
          pos: typeof w.pos === "string" ? w.pos.trim() : undefined,
          ipa: typeof w.ipa === "string" ? w.ipa.trim() : undefined,
          topic: typeof w.topic === "string" ? w.topic.trim() : undefined,
          leadVi: typeof w.leadVi === "string" ? w.leadVi.trim() : undefined,
          anticipateVi: typeof w.anticipateVi === "string" ? w.anticipateVi.trim() : undefined,
          usageEn: typeof w.usageEn === "string" ? w.usageEn.trim() : undefined,
          usageVi: typeof w.usageVi === "string" ? w.usageVi.trim() : undefined,
          chars: (word.match(/\p{L}/gu) ?? []).length,
          initial: word[0]?.toUpperCase() ?? "",
          nudge: typeof w.anticipateVi === "string" ? (w.anticipateVi as string).trim() : undefined,
          emphasis,
        } satisfies VocabularyWord;
      });
  }
}

function extractJsonArray(text: string): string {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  return start !== -1 && end > start ? text.slice(start, end + 1) : "[]";
}
