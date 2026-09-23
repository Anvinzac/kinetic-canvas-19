/** Public vocabulary transport/UI types; contains no catalog data. Exports: feed contracts. Depends on: schema types. */
import type { NarrativeStyle, VocabularyLevel, VocabularyWord } from "./lib/schema";

export type VocabularyFilters = { topic: string; level: VocabularyLevel | "" };
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
};
export type FeedCursor = { position: number; revision?: string };
export type Presentation = { theme: string; style: NarrativeStyle | "mix"; autoplay: boolean };
