/** WordCrawler validation and normalized catalog contract. Exports: schemas/types, normalizeDeck. Depends on: zod. */
import { z } from "zod";

export const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export const STYLE_IDS = ["detective", "speed", "confession", "minimal"] as const;
const optionalText = (max: number) => z.string().trim().max(max).optional().default("");
const wordSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-zA-Z0-9_-]+$/),
  word: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-zA-Z]+(?:['’-][a-zA-Z]+)*$/),
  defVi: z.string().trim().min(2).max(400),
  leadVi: optionalText(240),
  anticipateVi: optionalText(180),
  pos: optionalText(40),
  ipa: optionalText(120),
  topic: z
    .string()
    .trim()
    .toLowerCase()
    .max(60)
    .regex(/^[a-z0-9-]*$/)
    .optional()
    .default("general"),
  level: z.enum(LEVELS).optional(),
  style: z.enum(STYLE_IDS).optional(),
  chars: z.number().int().nonnegative().optional(),
  initial: z.string().max(4).optional(),
  usage: z
    .array(z.object({ en: z.string().trim().min(1).max(400), vi: optionalText(400) }))
    .max(5)
    .optional()
    .default([]),
});
const deckSchema = z.object({
  meta: z
    .object({ name: optionalText(160) })
    .passthrough()
    .optional(),
  words: z.array(wordSchema).min(1, "The deck must contain at least one word").max(100_000),
});
export type VocabularyWord = z.infer<typeof wordSchema>;
export type VocabularyLevel = (typeof LEVELS)[number];
export type NarrativeStyle = (typeof STYLE_IDS)[number];
export type Catalog = {
  revision: string;
  name: string;
  count: number;
  topics: string[];
  levels: VocabularyLevel[];
  words: VocabularyWord[];
};

/** Match a target as a whole word, preserving Unicode boundaries. @param word English target. @returns Global regex. */
export function answerPattern(word: string): RegExp {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}])${escaped}(?![\\p{L}])`, "giu");
}

/** Validate the complete deck before allowing any output. @param input Untrusted JSON. @returns Normalized content without a revision. */
export function normalizeDeck(input: unknown): Omit<Catalog, "revision"> {
  const parsed = deckSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n"),
    );
  }
  const ids = new Set<string>();
  const targets = new Set<string>();
  const errors: string[] = [];
  const words = parsed.data.words.map((entry, index) => {
    const word = entry.word.normalize("NFC").toLowerCase().replaceAll("’", "'");
    const id = entry.id.toLowerCase();
    if (ids.has(id)) errors.push(`words.${index}.id: Duplicate ID ${id}`);
    if (targets.has(word)) errors.push(`words.${index}.word: Duplicate word ${word}`);
    if (answerPattern(word).test(entry.anticipateVi)) {
      errors.push(`words.${index}.anticipateVi: Contains the English answer`);
    }
    ids.add(id);
    targets.add(word);
    return {
      ...entry,
      id,
      word,
      topic: entry.topic || "general",
      chars: (word.match(/\p{L}/gu) ?? []).length,
      initial: word[0].toUpperCase(),
    };
  });
  if (errors.length) throw new Error(errors.join("\n"));
  return {
    name: parsed.data.meta?.name || "WordCrawler vocabulary",
    count: words.length,
    topics: [...new Set(words.map((word) => word.topic))].sort(),
    levels: LEVELS.filter((level) => words.some((word) => word.level === level)),
    words,
  };
}
