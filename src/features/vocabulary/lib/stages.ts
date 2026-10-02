/** Explicit clue stages and answer masking (never infer pages from line breaks). Exports: buildStages, completeUsage. Depends on: schema. */
import { answerPattern, type NarrativeStyle, type VocabularyWord } from "./schema";
import { paginateText } from "@/features/post-player";

export type LearningStage = {
  id: string;
  label: string;
  text: string;
  secondary?: string;
  lang: "vi" | "en";
  reveal?: boolean;
  /** Emphasis phrases extracted from /word/ markers in the source text field. */
  dataEmphasis?: string[];
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
  const count = (word.word.match(/\p{L}/gu) ?? []).length;
  stages.push({
    id: "letters",
    label: "Đếm chữ cái",
    text: `Gồm ${count} chữ cái, bắt đầu bằng ${word.word[0].toUpperCase()}`,
    lang: "vi",
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
