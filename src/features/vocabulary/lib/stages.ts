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
};

/** Fill a deck's deliberate answer blank. @param text Example sentence. @param word Target. @returns Completed sentence. */
export function completeUsage(text: string, word: string): string {
  return text.replace(/_{2,}/g, word);
}

/** Create the supplied seven-stage flow, skipping absent optional content. @param word Catalog entry. @param style Narrative preset. @returns Ordered stages. */
export function buildStages(word: VocabularyWord, style: NarrativeStyle): LearningStage[] {
  const mask = (text: string) => text.replace(answerPattern(word.word), "_____");
  const stages: LearningStage[] = [];
  const leadLabels = {
    detective: "The scene",
    speed: "Ready?",
    confession: "Sound familiar?",
    minimal: "A thought",
  };
  if (word.leadVi)
    stages.push({ id: "lead", label: leadLabels[style], text: mask(word.leadVi), lang: "vi" });
  stages.push({ id: "definition", label: "The meaning", text: mask(word.defVi), lang: "vi" });
  const count = (word.word.match(/\p{L}/gu) ?? []).length;
  const prefix = style === "detective" ? "Manh mối — " : style === "confession" ? "Nhỏ thôi: " : "";
  stages.push({
    id: "letters",
    label: "Count the letters",
    text: `${prefix}Cả từ gồm ${count} chữ cái.`,
    lang: "vi",
  });
  const example = word.usage[0];
  if (example)
    stages.push({
      id: "usage",
      label: "In a sentence",
      text: mask(example.en),
      secondary: mask(example.vi),
      lang: "en",
    });
  stages.push({
    id: "initial",
    label: "A little hint",
    text: `${prefix}Từ này bắt đầu bằng chữ ${word.word[0].toUpperCase()}.`,
    lang: "vi",
  });
  if (word.anticipateVi)
    stages.push({
      id: "anticipation",
      label: "Your guess?",
      text: mask(word.anticipateVi),
      lang: "vi",
    });
  stages.push({ id: "reveal", label: "Meet your word", text: word.word, lang: "en", reveal: true });
  return stages.flatMap((stage) => {
    if (stage.reveal) return [stage];
    return paginateText(stage.text).map((text, index) => ({
      ...stage,
      id: `${stage.id}-${index}`,
      text,
    }));
  });
}
