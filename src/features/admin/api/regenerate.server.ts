/**
 * Asks the configured LLM to rewrite one flagged Vietnamese field.
 *
 * A reviewer picks what is wrong from fixed complaint chips rather than typing a prompt,
 * and the result is validated against the same rules the crawler's prompt asks for
 * (length window, no English, no quotes) before it is accepted. Two attempts, then the
 * reviewer is told to edit by hand — a model that keeps breaking the rules should not
 * quietly win.
 *
 * Exports: REGEN_FIELDS, RegenField, regeneratePhrase
 * Depends on: ../lib/llm.server
 */

import { llmChat, type LlmConfig } from "../lib/llm.server";

export const REGEN_FIELDS = ["defVi", "leadVi", "anticipateVi"] as const;
export type RegenField = (typeof REGEN_FIELDS)[number];

const SPECS: Record<RegenField, { minW: number; maxW: number; maxCh: number; rules: string }> = {
  defVi: {
    minW: 8,
    maxW: 11,
    maxCh: 140,
    rules:
      "ONE Vietnamese sentence defining the English word. It must be a definition: clear, direct, no riddles. " +
      "Never include the English word or any English word. Never wrap anything in quotes or parentheses. " +
      "Never write a circular definition (the word reused in its own definition).",
  },
  leadVi: {
    minW: 8,
    maxW: 11,
    maxCh: 120,
    rules:
      "A Vietnamese riddle-style teaser that hints at the meaning WITHOUT naming it directly. " +
      "Never include the English word or any English word. Never restate the definition. " +
      "Create curiosity — a picture or feeling, not an explanation.",
  },
  anticipateVi: {
    minW: 3,
    maxW: 8,
    maxCh: 40,
    rules:
      "A very short playful Vietnamese invitation for the learner to guess the word before it is revealed. " +
      "Pure Vietnamese, fun and inviting (e.g. 'Đoán xem nào…'). Never state a fact.",
  },
};

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Generate one replacement phrase, retrying once when the model breaks a rule.
 * @param cfg - the configured LLM profile
 * @param field - which card field to rewrite
 * @param ctx - the word, its level and topic, the rejected text, and the complaints
 * @returns The accepted phrase plus any emphasis marks that occur in it verbatim
 */
export async function regeneratePhrase(
  cfg: LlmConfig,
  field: RegenField,
  ctx: {
    english: string;
    level?: string | null;
    topic: string;
    current: string;
    complaints: string[];
    otherFields: string;
  },
): Promise<{ phrase: string; emphasis: string[] }> {
  const spec = SPECS[field];
  const wantsEmphasis = field !== "anticipateVi";
  const basePrompt = [
    `Write a replacement for the "${field}" field of a Vietnamese vocabulary card for the English word "${ctx.english}".`,
    "",
    `Field rules: ${spec.rules}`,
    `Length: exactly ${spec.minW}–${spec.maxW} Vietnamese words (space-separated syllables), max ${spec.maxCh} characters.`,
    `The learner's level is ${ctx.level ?? "B1"}, topic ${ctx.topic || "general"}.`,
    "",
    `Current version (rejected): "${ctx.current}"`,
    `Reviewer complaints: ${ctx.complaints.join("; ")}`,
    ctx.otherFields ? `Other fields on this card (do NOT copy them): ${ctx.otherFields}` : "",
    wantsEmphasis
      ? "Mark the 1–2 short spoken phrases (2–3 syllables each) worth highlighting by wrapping them in *asterisks*."
      : "",
    "",
    "Fix every complaint. Reply with ONLY the new Vietnamese phrase — no quotes, no explanations.",
  ]
    .filter(Boolean)
    .join("\n");

  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const textBlock = await llmChat(cfg, {
      system:
        "You write Vietnamese vocabulary card fields for a mobile learning app. " +
        "Output natural, idiomatic Vietnamese with full diacritics — the way a young Vietnamese speaker would phrase it. " +
        "Never mix in English words.",
      user:
        attempt === 0
          ? basePrompt
          : `${basePrompt}\n\n(Previous attempt failed validation: ${lastError}. Try a completely different phrasing.)`,
      maxTokens: 128,
      temperature: attempt === 0 ? 0.8 : 1,
    });

    // Pull *highlighted* marks before stripping them from the sentence.
    const emphasis = [...textBlock.matchAll(/\*([^*\n]+)\*/g)]
      .map((match) => match[1]!.trim())
      .slice(0, 2);
    const phrase = textBlock
      .replace(/\*([^*\n]+)\*/g, "$1")
      .trim()
      .split("\n")[0]!
      .replace(/^["'“”]+|["'“”.]+$/g, "")
      .trim();

    const count = wordCount(phrase);
    if (!phrase) {
      lastError = "empty response";
      continue;
    }
    if (count < spec.minW || count > spec.maxW) {
      lastError = `${count} words, need ${spec.minW}-${spec.maxW}`;
      continue;
    }
    if (phrase.length > spec.maxCh) {
      lastError = `${phrase.length} chars, max ${spec.maxCh}`;
      continue;
    }
    if (new RegExp(`\\b${ctx.english}\\b`, "i").test(phrase)) {
      lastError = `contains the English word "${ctx.english}"`;
      continue;
    }
    // Keep only marks that occur verbatim, so the renderer never glows a missing phrase.
    const valid = emphasis.filter(
      (candidate) =>
        phrase.includes(candidate) && wordCount(candidate) >= 2 && wordCount(candidate) <= 3,
    );
    return { phrase, emphasis: wantsEmphasis ? valid : [] };
  }
  throw new Error(`LLM output kept failing rules (${lastError}). Edit the cell manually instead.`);
}
