/**
 * Crawler annotation contract — the exact shape the LLM must produce,
 * BEFORE deck conversion.
 *
 * Responsibility: define the ten contract fields, validate untrusted model
 * output with Zod, and repair the leaks that would break the feed: the English
 * target appearing in Vietnamese text, example sentences missing their `_____`
 * blank, and a teaser whose noun was dropped. Levels are NEVER taken from the
 * model.
 *
 * Exports: CRAWLER_ANNOTATION_FIELDS, CrawlerAnnotation, crawlerAnnotationSchema,
 *          annotationWordPattern, containsTargetWord, blankOutTarget,
 *          countVietnameseWords, checkVietnameseProse, findDanglingDemonstrative,
 *          parseAnnotation, parseAnnotationList
 * Depends on: zod
 */
import { z } from "zod";

/**
 * The exact annotation contract. `level` is deliberately absent: it comes from
 * the corpus and must survive untouched.
 */
export const CRAWLER_ANNOTATION_FIELDS = [
  "word",
  "pos",
  "ipa",
  "defVi",
  "leadVi",
  "anticipateVi",
  "usageEn",
  "usageVi",
  "topic",
  "emphasisVi",
] as const;

/** One contract field name. */
export type CrawlerAnnotationField = (typeof CRAWLER_ANNOTATION_FIELDS)[number];

/** A validated annotation for one English word. */
export interface CrawlerAnnotation {
  word: string;
  pos: string;
  ipa: string;
  defVi: string;
  leadVi: string;
  anticipateVi: string;
  usageEn: string;
  usageVi: string;
  topic: string;
  emphasisVi: string[];
}

/** Same surface pattern the downstream deck contract enforces for `<word>`. */
export const annotationWordPattern = /^[a-z]+(?:['’-][a-z]+)*$/;

const text = (max: number) => z.string().trim().max(max);

/**
 * Zod schema for one annotation. Unknown keys are stripped by Zod instead of
 * rejected, so a model that echoes `level` still yields a usable annotation —
 * the caller records a warning when that happens.
 */
export const crawlerAnnotationSchema = z.object({
  word: z.string().trim().min(2).max(64),
  pos: text(40).optional().default(""),
  ipa: text(120).optional().default(""),
  defVi: z.string().trim().min(2).max(400),
  leadVi: text(240).optional().default(""),
  anticipateVi: text(180).optional().default(""),
  usageEn: z.string().trim().min(1).max(400),
  usageVi: text(400).optional().default(""),
  topic: text(60).optional().default("general"),
  emphasisVi: z.array(z.string().trim().min(2).max(60)).max(8).optional().default([]),
});

/** Escape a word for use inside a regular expression. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whole-word test that respects Unicode boundaries, so "art" does not match
 * inside "artist". Mirrors the downstream app's answer-pattern rule.
 *
 * @param textValue - text to search (Vietnamese or English)
 * @param word - English target
 * @returns true when the word appears as a standalone token
 */
export function containsTargetWord(textValue: string, word: string): boolean {
  const pattern = new RegExp(`(?<![\\p{L}])${escapeRegExp(word)}(?![\\p{L}])`, "iu");
  return pattern.test(textValue);
}

/**
 * Replace every standalone occurrence of the target with the deck blank.
 *
 * @param sentence - English example sentence (or any text)
 * @param word - English target
 * @returns rewritten text plus how many occurrences were replaced
 */
export function blankOutTarget(
  sentence: string,
  word: string,
): { text: string; replaced: number } {
  const pattern = new RegExp(`(?<![\\p{L}])${escapeRegExp(word)}(?![\\p{L}])`, "giu");
  let replaced = 0;
  const rewritten = sentence.replace(pattern, () => {
    replaced += 1;
    return "_____";
  });
  return { text: rewritten, replaced };
}

/** The five-underscore blank the feed renders as the missing answer. */
const BLANK = "_____";

/** Word count the prompt demands for `defVi` and `leadVi`. */
const VI_PROSE_WORD_RANGE = [8, 11] as const;

/**
 * A quantifier glued straight to a demonstrative ("những này", "mỗi này") is a
 * sentence whose noun is missing — the model does this to dodge naming the
 * answer. "thứ này" and "người này" stay legal because a real noun sits between
 * the quantifier and the demonstrative.
 */
const DANGLING_DEMONSTRATIVE = /\b(những|các|mỗi|từng|nhiều|vài|bao nhiêu)\s+này\b/iu;

/**
 * Find the first quantifier that lost its noun.
 *
 * @param textValue - Vietnamese text, with or without emphasis markers
 * @returns the offending phrase, or null when the text is grammatical
 */
export function findDanglingDemonstrative(textValue: string): string | null {
  const match = DANGLING_DEMONSTRATIVE.exec(textValue);
  return match === null ? null : match[0];
}

/**
 * Count the Vietnamese words of a field. Vietnamese syllables are one token
 * each, so space-splitting is the count the prompt and the feed both mean;
 * emphasis markers and punctuation do not add tokens.
 *
 * @param textValue - defVi or leadVi, possibly carrying `/marker/` pairs
 * @returns number of letter/digit tokens
 */
export function countVietnameseWords(textValue: string): number {
  return textValue
    .replaceAll("/", " ")
    .split(/\s+/u)
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

/**
 * Advisory Vietnamese prose checks the Zod schema cannot express.
 *
 * These never reject an annotation — a six-word definition still renders — but
 * they must be reported: the deck page looks thin, and a teaser with a dangling
 * quantifier reads as broken Vietnamese to the learner.
 *
 * @param field - field name used to prefix each issue
 * @param textValue - the Vietnamese text as written by the model
 * @returns human-readable issues (empty when the text is clean)
 */
export function checkVietnameseProse(field: string, textValue: string): string[] {
  if (textValue.trim().length === 0) return [];
  const issues: string[] = [];
  const words = countVietnameseWords(textValue);
  if (words < VI_PROSE_WORD_RANGE[0] || words > VI_PROSE_WORD_RANGE[1]) {
    issues.push(
      `${field}: ${words} words, the prompt asks for ${VI_PROSE_WORD_RANGE[0]}-${VI_PROSE_WORD_RANGE[1]}`,
    );
  }
  const dangling = findDanglingDemonstrative(textValue);
  if (dangling !== null) {
    issues.push(
      `${field}: "${dangling}" leaves a quantifier without a noun — not a complete Vietnamese sentence`,
    );
  }
  return issues;
}

/**
 * Validate and repair one raw annotation object.
 *
 * Repairs (each with a warning, never a silent change):
 * - `word` is lowercased/NFC-normalized and must match the requested word.
 * - `usageEn` gets the target blanked out; a missing blank is added when the
 *   target is present, otherwise flagged.
 * - `anticipateVi` is emptied when it leaks the English answer.
 * - `level` and other unknown fields are dropped.
 *
 * @param raw - one item from the model's JSON array
 * @param expectedWord - corpus word this item should describe (null = accept any)
 * @returns the annotation (when valid) plus human-readable warnings/errors
 */
export function parseAnnotation(
  raw: unknown,
  expectedWord: string | null,
): { annotation: CrawlerAnnotation | null; issues: string[] } {
  const issues: string[] = [];
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { annotation: null, issues: ["item is not a JSON object"] };
  }

  const record = raw as Record<string, unknown>;
  const extraKeys = Object.keys(record).filter(
    (key) => !CRAWLER_ANNOTATION_FIELDS.includes(key as CrawlerAnnotationField),
  );
  if (extraKeys.length > 0) {
    issues.push(`ignored extra field(s): ${extraKeys.join(", ")} (level is always corpus-assigned)`);
  }

  const parsed = crawlerAnnotationSchema.safeParse(record);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push(`${issue.path.join(".") || "item"}: ${issue.message}`);
    }
    return { annotation: null, issues };
  }

  const data = parsed.data;
  const word = data.word.normalize("NFC").toLowerCase();
  if (!annotationWordPattern.test(word)) {
    issues.push(`word: "${data.word}" is not a plain English word`);
    return { annotation: null, issues };
  }
  if (expectedWord !== null && word !== expectedWord) {
    issues.push(`word: model returned "${word}" but "${expectedWord}" was requested`);
    return { annotation: null, issues };
  }

  // Example sentence: blank out the answer, or flag a sentence that already
  // leaks it / has no blank at all.
  let usageEn = data.usageEn;
  if (!usageEn.includes(BLANK)) {
    const blanked = blankOutTarget(usageEn, word);
    usageEn = blanked.text;
    if (blanked.replaced > 0) {
      issues.push(`usageEn: target word was auto-blanked (${blanked.replaced} occurrence(s))`);
    } else {
      issues.push("usageEn: no _____ placeholder and the target word is absent");
    }
  } else if (containsTargetWord(usageEn, word)) {
    const blanked = blankOutTarget(usageEn, word);
    usageEn = blanked.text;
    issues.push(`usageEn: leaked the answer next to the blank; blanked it out`);
  }

  // The Vietnamese teaser must never contain the English answer.
  let anticipateVi = data.anticipateVi;
  if (containsTargetWord(anticipateVi, word)) {
    anticipateVi = "";
    issues.push("anticipateVi: leaked the English answer and was emptied");
  }

  issues.push(...checkVietnameseProse("defVi", data.defVi));

  // A teaser that lost its noun is broken Vietnamese in front of a learner, and
  // nothing here can invent the noun back. `leadVi` is optional all the way to
  // the feed (buildStages skips an empty one), so drop the page instead of
  // showing the mistake — same repair style as an answer-leaking anticipateVi.
  let leadVi = data.leadVi;
  const danglingLead = findDanglingDemonstrative(leadVi);
  if (danglingLead !== null) {
    leadVi = "";
    issues.push(
      `leadVi: emptied — "${danglingLead}" leaves a quantifier without a noun, and a broken teaser is worse than no teaser`,
    );
  } else {
    issues.push(...checkVietnameseProse("leadVi", leadVi));
  }

  return {
    annotation: {
      word,
      pos: data.pos,
      ipa: data.ipa,
      defVi: data.defVi,
      leadVi,
      anticipateVi,
      usageEn,
      usageVi: data.usageVi,
      topic: data.topic.toLowerCase(),
      emphasisVi: data.emphasisVi,
    },
    issues,
  };
}

/**
 * Validate a whole model response against the batch that was requested.
 * Words are matched by normalized surface form, one-to-one; anything missing,
 * duplicated, or unexpected becomes an issue instead of silently passing.
 *
 * @param rawItems - parsed JSON array items from the model text
 * @param requestedWords - corpus words the batch asked for, in order
 * @returns annotations in requested order plus per-word reports and issues
 */
export function parseAnnotationList(
  rawItems: readonly unknown[],
  requestedWords: readonly string[],
): {
  annotations: Map<string, CrawlerAnnotation>;
  issues: string[];
} {
  const issues: string[] = [];
  const requested = new Set(requestedWords);
  const annotations = new Map<string, CrawlerAnnotation>();
  const seen = new Set<string>();

  for (const [index, item] of rawItems.entries()) {
    const rawWord =
      typeof item === "object" && item !== null
        ? String((item as Record<string, unknown>).word ?? "")
        : "";
    const normalized = rawWord.normalize("NFC").toLowerCase();
    const expected = requested.has(normalized) ? normalized : null;

    if (expected === null) {
      issues.push(`item ${index}: "${rawWord || "<missing word>"}" was not requested`);
      continue;
    }
    if (seen.has(expected)) {
      issues.push(`item ${index}: duplicate annotation for "${expected}"`);
      continue;
    }

    const result = parseAnnotation(item, expected);
    for (const issue of result.issues) issues.push(`${expected}: ${issue}`);
    if (result.annotation !== null) {
      annotations.set(expected, result.annotation);
      seen.add(expected);
    }
  }

  for (const word of requestedWords) {
    if (!annotations.has(word)) issues.push(`${word}: no usable annotation in this batch`);
  }

  return { annotations, issues };
}
