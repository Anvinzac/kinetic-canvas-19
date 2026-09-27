/**
 * Prompt builder — the instructions sent to the Anthropic Messages API.
 *
 * Responsibility: describe the ten-field annotation contract, the Vietnamese
 * writing rules, and the output format, and render a batch of corpus words as
 * a numbered list. Difficulty levels are passed as context only; the prompt
 * forbids echoing them back, and the parser drops them anyway.
 *
 * Exports: ANNOTATION_SYSTEM_PROMPT, buildBatchPrompt
 * Depends on: ../corpus.ts, ./contract.ts
 */
import type { CorpusWord } from "../corpus.ts";
import { CRAWLER_ANNOTATION_FIELDS } from "./contract.ts";

/** Fields the model is allowed to return, rendered into the prompt. */
const FIELD_LIST = CRAWLER_ANNOTATION_FIELDS.join(", ");

/**
 * System prompt. Kept in one constant so the contract, the parser, and the
 * tests can all point at the same source of truth.
 */
export const ANNOTATION_SYSTEM_PROMPT = `You write Vietnamese vocabulary cards for a mobile "learn one English word at a time" app.
The reader is a Vietnamese learner who sees Vietnamese first and only later the English word.

For every requested word, return exactly one JSON object with these ${CRAWLER_ANNOTATION_FIELDS.length} fields and no others: ${FIELD_LIST}.

Field rules:
- "word": the English headword, copied exactly as given.
- "pos": one of noun, verb, adj, adv, prep, conj, phrase.
- "ipa": IPA in slashes, e.g. "/ˈwɔː.tər/".
- "defVi": ONE Vietnamese sentence defining the word, exactly 8–11 words, at most 140 characters, no English words.
- "leadVi": a Vietnamese teaser that hints at the meaning without naming it, exactly 8–11 words, at most 120 characters, no English words.
- "anticipateVi": a very short Vietnamese invitation to guess (for example "Đoán xem nào…"), 3–8 words, at most 60 characters, never any English word.
- "usageEn": ONE natural English example sentence of at most 20 words in which the target word is replaced by exactly five underscores: _____.
- "usageVi": the Vietnamese meaning of that example sentence.
- "topic": one lowercase tag from: work, study, daily, communication, emotion, thinking, character, attention, time, travel, health, money, nature, society, technology, general.
- "emphasisVi": 2 to 4 Vietnamese phrases that will glow on screen. Each phrase must be copied EXACTLY, diacritics included, from the defVi or leadVi you wrote, and must be:
  * 2 or 3 syllables taken from one neighbouring pair or triple of words (never a whole sentence, never a single syllable),
  * a meaningful unit (usually a noun phrase, verb phrase, or adjective + noun), never a function word such as và, là, của, có, được, trong, cho, với, một, rất, cũng, đã, đang, sẽ, không, những, các, thì, mà,
  * at most 30 characters, and unique inside the list.

Hard rules:
- Write correct Vietnamese with full diacritics everywhere in Vietnamese fields.
- Never include the English target word (or any English word) in defVi, leadVi, or anticipateVi.
- Never add a "level" field or any field outside the list of ${CRAWLER_ANNOTATION_FIELDS.length} fields — difficulty is handled outside this request.
- Return ONLY a JSON array with one object per requested word, in the requested order. No markdown fences, no headings, no commentary.

Minimal example of the expected format (one word, shortened):
[{"word":"water","pos":"noun","ipa":"/ˈwɔː.tər/","defVi":"Chất lỏng trong suốt mà ta uống mỗi ngày.","leadVi":"Có thứ này thì cây mới sống được.","anticipateVi":"Đoán xem nào…","usageEn":"Please bring me a glass of _____.","usageVi":"Làm ơn mang cho tôi một cốc nước.","topic":"nature","emphasisVi":["Chất lỏng","uống mỗi ngày"]}]`;

/**
 * Render one batch of corpus words as the user message.
 *
 * @param words - corpus words for this batch (already frequency-sorted)
 * @returns user message text with the numbered word list
 */
export function buildBatchPrompt(words: readonly CorpusWord[]): string {
  const lines = words.map((entry, index) => {
    const hint = entry.pos.length > 0 ? `, ${entry.pos}` : "";
    return `${index + 1}. ${entry.word} (${entry.level}${hint})`;
  });
  return [
    `Annotate these ${words.length} English words.`,
    "The CEFR level in brackets only tells you how simple the Vietnamese must be — do not echo it.",
    "",
    lines.join("\n"),
    "",
    `Return the JSON array with exactly ${words.length} objects, in this order.`,
  ].join("\n");
}
