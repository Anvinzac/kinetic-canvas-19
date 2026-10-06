/** WordCrawler validation and normalized catalog contract. Exports: schemas/types, normalizeDeck. Depends on: zod. */
import { z } from "zod";

export const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export const STYLE_IDS = ["detective", "speed", "confession", "minimal"] as const;
const optionalText = (max: number) => z.string().trim().max(max).optional().default("");
/** A grouping-axis value: lowercase slug, no spaces, so it is safe in a URL filter. */
const taxonomySlug = (max: number) =>
  z
    .string()
    .trim()
    .toLowerCase()
    .max(max)
    .regex(/^[a-z0-9-]+$/);
// Crawler-produced Vietnamese emphasis annotations (deck field `emphasis`, converted
// from the crawler's internal emphasisVi). Meaningful phrases only: trimmed,
// letter-bearing, short enough to be a compound phrase rather than a sentence.
const emphasisPhrase = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .refine((phrase) => /\p{L}/u.test(phrase), "Emphasis phrases must contain letters")
  .refine(
    (phrase) => phrase.split(/\s+/).filter(Boolean).length <= 6,
    "Emphasis phrases must be at most 6 words",
  );
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
  emphasis: z.array(emphasisPhrase).max(6).optional(),
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
  // The canonical usage axis. `topic` above stays as the first of these, so readers and
  // scripts written against the single-value field keep working.
  topics: z.array(taxonomySlug(60)).max(6).optional(),
  /** Exam and competition targets this word is prepared for. */
  exams: z.array(taxonomySlug(40)).max(8).optional(),
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

/**
 * Normalize emphasis annotations: NFC + whitespace collapse, deduplicated by a
 * case-insensitive key that keeps diacritics (so "những"/"nhưng" stay distinct).
 * The first occurrence wins and is kept verbatim for exact downstream matching.
 * @param phrases Raw deck annotations.
 * @returns Normalized deduplicated phrases, or undefined when none survive.
 */
function normalizeEmphasisPhrases(phrases?: string[]): string[] | undefined {
  if (!phrases?.length) return undefined;
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const phrase of phrases) {
    const value = phrase.normalize("NFC").trim().replace(/\s+/g, " ");
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(value);
  }
  return normalized.length ? normalized : undefined;
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
    // The multi-valued axis is canonical. A deck carrying only the legacy single
    // `topic` is lifted into it, and `topic` is always restated as the first entry so
    // the two can never disagree.
    const topics = [...new Set(entry.topics?.length ? entry.topics : [entry.topic || "general"])];
    return {
      ...entry,
      id,
      word,
      topic: topics[0]!,
      topics,
      exams: entry.exams?.length ? [...new Set(entry.exams)] : undefined,
      chars: (word.match(/\p{L}/gu) ?? []).length,
      initial: word[0].toUpperCase(),
      emphasis: normalizeEmphasisPhrases(entry.emphasis),
    };
  });
  if (errors.length) throw new Error(errors.join("\n"));
  return {
    name: parsed.data.meta?.name || "WordCrawler vocabulary",
    count: words.length,
    topics: [...new Set(words.flatMap((word) => word.topics))].sort(),
    levels: LEVELS.filter((level) => words.some((word) => word.level === level)),
    words,
  };
}

/**
 * Compact, stable FNV-1a hash rendered as hex. Used to derive one revision for a
 * merged catalog so pagination stays deterministic for a given set of inputs without
 * pulling in node:crypto on the client.
 * @param input Any string
 * @returns 8-char hex digest
 * @pure true
 */
function stableHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * Merge compiled catalogs — the admin-editable base plus any number of read-only
 * third-party packs — into the single catalog the feed serves. Words are de-duplicated
 * by id and by headword with the FIRST catalog winning, so the base always overrides a
 * provider pack that ships the same word. `count`, `topics`, `levels`, `revision` and
 * `name` are recomputed from the merged words so filters and deterministic pagination
 * reflect the union rather than any one input.
 * @param catalogs - base catalog first, then packs in a stable (sorted-by-path) order
 * @returns One merged Catalog
 * @pure true
 */
export function mergeCatalogs(...catalogs: Catalog[]): Catalog {
  const seenIds = new Set<string>();
  const seenWords = new Set<string>();
  const words: VocabularyWord[] = [];
  for (const source of catalogs) {
    for (const word of source.words) {
      const id = word.id.toLowerCase();
      const head = word.word.toLowerCase();
      // First pack wins: a duplicate id or headword from a later pack is dropped so the
      // feed never shows the same word twice and reaction/storage keys stay unambiguous.
      if (seenIds.has(id) || seenWords.has(head)) continue;
      seenIds.add(id);
      seenWords.add(head);
      words.push(word);
    }
  }
  const base = catalogs[0];
  const revision = stableHash(
    catalogs.map((catalog) => `${catalog.revision}:${catalog.count}`).join("|"),
  );
  const name =
    catalogs.length > 1
      ? `${base?.name ?? "WordCrawler vocabulary"} + ${catalogs.length - 1} pack${
          catalogs.length > 2 ? "s" : ""
        }`
      : (base?.name ?? "WordCrawler vocabulary");
  return {
    revision,
    name,
    count: words.length,
    topics: [
      ...new Set(words.flatMap((word) => (word.topics?.length ? word.topics : [word.topic]))),
    ].sort(),
    levels: LEVELS.filter((level) => words.some((word) => word.level === level)),
    words,
  };
}
