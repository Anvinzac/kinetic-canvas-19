/** Explicit clue stages and answer masking (never infer pages from line breaks). Exports: buildStages, completeUsage, splitEmphasisMarkers. Depends on: schema, kinetic-text emphasis types. */
import type { EmphasisVariant } from "@/features/kinetic-text";
import { answerPattern, type NarrativeStyle, type VocabularyWord } from "./schema";
import { paginateText } from "@/features/post-player";

/**
 * Effect used for the starting initial on the letter-count clue. `frame` draws a
 * box around the glyph, which is the one variant that reads as a container for a
 * single letter rather than as a recolor, so it stays visibly distinct from the
 * mark the letter count already carries.
 */
const INITIAL_EMPHASIS_VARIANT: EmphasisVariant = "frame";

export type LearningStage = {
  id: string;
  label: string;
  text: string;
  secondary?: string;
  lang: "vi" | "en";
  reveal?: boolean;
  /** Emphasis phrases extracted from /word/ markers in the source text field. */
  dataEmphasis?: string[];
  /** Second highlight drawn with its own effect, independent of `dataEmphasis`. */
  secondaryEmphasis?: { phrase: string; variant: EmphasisVariant };
};

/**
 * Parse /word/ emphasis markers from a text field.
 * Returns the clean text (markers stripped) and the list of marked phrases.
 */
function parseEmphasisMarkers(text: string): { clean: string; markers: string[] } {
  const markers: string[] = [];
  const clean = text.replace(/\/([^/]+)\//g, (_, word) => {
    markers.push(word.trim());
    return word.trim();
  });
  return { clean, markers };
}

/**
 * Split a deck text field on its /word/ emphasis markers, for surfaces that render
 * the sentence as prose rather than as kinetic text. The markers are an authoring
 * convention and must never reach the screen as literal slashes.
 * @param text - Source field, possibly carrying /word/ markers
 * @returns Ordered runs; `marked` is true for a phrase that sat between markers
 * @pure true
 */
export function splitEmphasisMarkers(text: string): { text: string; marked: boolean }[] {
  const parts: { text: string; marked: boolean }[] = [];
  let cursor = 0;
  for (const match of text.matchAll(/\/([^/]+)\//g)) {
    const start = match.index ?? 0;
    if (start > cursor) parts.push({ text: text.slice(cursor, start), marked: false });
    parts.push({ text: match[1]!.trim(), marked: true });
    cursor = start + match[0].length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), marked: false });
  return parts;
}

/** Fill a deck's deliberate answer blank. @param text Example sentence. @param word Target. @returns Completed sentence. */
export function completeUsage(text: string, word: string): string {
  return text.replace(/_{2,}/g, word);
}

/** Create the supplied seven-stage flow, skipping absent optional content. @param word Catalog entry. @param style Narrative preset. @returns Ordered stages. */
export function buildStages(word: VocabularyWord, style: NarrativeStyle): LearningStage[] {
  const mask = (text: string) => text.replace(answerPattern(word.word), "_____");
  const stages: LearningStage[] = [];
  const leadLabels: Record<NarrativeStyle, string> = {
    detective: "Bối cảnh",
    speed: "Sẵn sàng chưa?",
    confession: "Có quen không?",
    minimal: "Một suy nghĩ",
  };
  if (word.leadVi) {
    const { clean, markers } = parseEmphasisMarkers(word.leadVi);
    stages.push({
      id: "lead",
      label: leadLabels[style],
      text: mask(clean),
      lang: "vi",
      dataEmphasis: markers.length ? markers : undefined,
    });
  }
  {
    const { clean, markers } = parseEmphasisMarkers(word.defVi);
    stages.push({
      id: "definition",
      label: "Ý nghĩa",
      text: mask(clean),
      lang: "vi",
      dataEmphasis: markers.length ? markers : undefined,
    });
  }
  const hanCount = (word.word.match(/\p{Script=Han}/gu) ?? []).length;
  if (hanCount > 0) {
    // Chinese: the first character would give away half a 2-character word, so the
    // clue is the character count plus the first pinyin letter.
    const pinyinInitial = (word.ipa?.trim()[0] ?? "").toUpperCase();
    stages.push({
      id: "letters",
      label: "Đếm chữ Hán",
      text: pinyinInitial
        ? `Gồm ${hanCount} chữ Hán, pinyin bắt đầu bằng ${pinyinInitial}`
        : `Gồm ${hanCount} chữ Hán`,
      lang: "vi",
      secondaryEmphasis: pinyinInitial
        ? { phrase: pinyinInitial, variant: INITIAL_EMPHASIS_VARIANT }
        : undefined,
    });
  }
  const count = (word.word.match(/\p{L}/gu) ?? []).length;
  const initial = word.word[0].toUpperCase();
  if (hanCount === 0) stages.push({
    id: "letters",
    label: "Đếm chữ cái",
    text: `Gồm ${count} chữ cái, bắt đầu bằng ${initial}`,
    lang: "vi",
    // The count keeps the primary mark on purpose — getWordImportance scores a
    // standalone number above everything so the digits always win this sentence.
    // The initial is added as a second, differently-drawn mark rather than
    // replacing it, so one page carries both facts.
    secondaryEmphasis: { phrase: initial, variant: INITIAL_EMPHASIS_VARIANT },
  });
  const example = word.usage[0];
  if (example) {
    const { clean: enClean, markers: enMarkers } = parseEmphasisMarkers(example.en);
    const { clean: viClean } = parseEmphasisMarkers(example.vi);
    stages.push({
      id: "usage",
      label: "Trong câu",
      text: mask(enClean),
      secondary: mask(viClean),
      lang: "en",
      dataEmphasis: enMarkers.length ? enMarkers : undefined,
    });
  }
  if (word.anticipateVi) {
    const { clean, markers } = parseEmphasisMarkers(word.anticipateVi);
    stages.push({
      id: "anticipation",
      label: "Bạn đoán gì?",
      text: mask(clean),
      lang: "vi",
      dataEmphasis: markers.length ? markers : undefined,
    });
  }
  stages.push({ id: "reveal", label: "Đây rồi!", text: word.word, lang: "en", reveal: true });
  return stages.flatMap((stage) => {
    if (stage.reveal) return [stage];
    return paginateText(stage.text).map((text, index) => ({
      ...stage,
      id: `${stage.id}-${index}`,
      text,
    }));
  });
}
