/** Public vocabulary transport/UI types; contains no catalog data. Exports: feed contracts. Depends on: schema types. */
import type { NarrativeStyle, VocabularyLevel, VocabularyWord } from "./lib/schema";

export type VocabularyFilters = {
  topic: string;
  level: VocabularyLevel | "";
  /** Difficulty track id, or "" for every level. Resolved to a CEFR band server-side. */
  difficulty: string;
};
export type FeedRequest = VocabularyFilters & {
  seed: string;
  position: number;
  revision?: string;
  limit: number;
};
export type FeedEntry = {
  occurrenceId: string;
  position: number;
  cycle: number;
  word: VocabularyWord;
};
export type FeedPage = {
  entries: FeedEntry[];
  seed: string;
  revision: string;
  position: number;
  previousPosition: number | null;
  nextPosition: number | null;
  total: number;
  matching: number;
  name: string;
  topics: string[];
  levels: VocabularyLevel[];
  /** Words per CEFR level under the page's topic filter; sizes the difficulty picker. */
  levelCounts: Partial<Record<VocabularyLevel, number>>;
  /** A few representative words per level, for the onboarding picker's samples. */
  levelSamples: Partial<Record<VocabularyLevel, { word: string; defVi: string }[]>>;
};
export type FeedCursor = { position: number; revision?: string };
/**
 * `theme` is an allow-list: "mix" lets every theme rotate, one id locks the look,
 * and a comma-joined id list (the picker's unselect model) rotates within just those.
 */
export type Presentation = { theme: string; style: NarrativeStyle | "mix"; autoplay: boolean };
