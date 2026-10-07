/**
 * Vietnamese annotation scoring — turns one model's batch output into numbers.
 *
 * Responsibility: judge how well a model writes the Vietnamese the feed needs,
 * using the SAME checkers the crawl pipeline already applies
 * (`checkVietnameseProse`, `findDanglingDemonstrative`, `containsTargetWord`,
 * `validateEmphasis`). Nothing here re-implements a rule: a defect counted by
 * the bench is a defect the crawl would have warned about or repaired.
 *
 * "Is this Vietnamese at all?" comes from `../vietnamese.ts`, the same syllable
 * validator the crawl pipeline and the deck validator now enforce, so the bench
 * and a live crawl cannot disagree about what counts as Vietnamese.
 *
 * Exports: BENCH_CHECKS, BenchCheck, CHECK_WEIGHTS, ALLOWED_POS, ALLOWED_TOPICS,
 *          classifyEmphasisWarning, EmphasisDropReason, WordScore, ModelScore,
 *          scoreWord, scoreAnnotations
 * Depends on: ../annotate/contract.ts, ../emphasis.ts, ../corpus.ts,
 *             ../vietnamese.ts
 */
import type { CorpusWord } from "../corpus.ts";
import {
  checkVietnameseProse,
  containsTargetWord,
  findDanglingDemonstrative,
  type CrawlerAnnotation,
} from "../annotate/contract.ts";
import { validateEmphasis } from "../emphasis.ts";
import {
  DIACRITIC_RATIO_FLOOR,
  diacriticRatio,
  findEnglishMarkers,
  findForeignTokens,
} from "../vietnamese.ts";

/**
 * The checks that make up a score, in report order. Each one is pass/fail per
 * word, so a rate is always "share of the bench words that passed".
 */
export const BENCH_CHECKS = [
  "returned",
  "vietnameseOnly",
  "diacritics",
  "completeSentence",
  "emphasisWhole",
  "emphasisEnough",
  "proseLength",
  "usageBlank",
  "usageVi",
  "fieldsValid",
] as const;

/** One check name. */
export type BenchCheck = (typeof BENCH_CHECKS)[number];

/**
 * Weights of the composite score, summing to 100.
 *
 * The ranking is deliberate and is the bench's only judgement call: a word that
 * never came back, Vietnamese with English in it, a sentence missing its noun,
 * and emphasis that cuts a compound word in half are the four failures a reader
 * of the app would actually notice. Prose length and the example sentence are
 * real but cosmetic, and the enum/IPA fields are the easiest thing in the
 * contract to get right.
 */
export const CHECK_WEIGHTS: Readonly<Record<BenchCheck, number>> = {
  returned: 15,
  vietnameseOnly: 15,
  diacritics: 10,
  completeSentence: 15,
  emphasisWhole: 15,
  emphasisEnough: 5,
  proseLength: 10,
  usageBlank: 5,
  usageVi: 5,
  fieldsValid: 5,
};

/** `pos` values the prompt allows. */
export const ALLOWED_POS: ReadonlySet<string> = new Set([
  "noun",
  "verb",
  "adj",
  "adv",
  "prep",
  "conj",
  "phrase",
]);

/** `topic` tags the prompt allows. */
export const ALLOWED_TOPICS: ReadonlySet<string> = new Set([
  "work",
  "study",
  "daily",
  "communication",
  "emotion",
  "thinking",
  "character",
  "attention",
  "time",
  "travel",
  "health",
  "money",
  "nature",
  "society",
  "technology",
  "general",
]);

/** Why `validateEmphasis` refused or altered a proposed phrase. */
export type EmphasisDropReason =
  | "notQuoted"
  | "compoundHalf"
  | "functionWords"
  | "overlap"
  | "duplicate"
  | "singleSyllable"
  | "recased"
  | "other";

/**
 * Map one `validateEmphasis` warning to a reason bucket.
 *
 * The substrings below are the warning texts `src/emphasis.ts` produces; the
 * bench's tests pin them so a reworded warning cannot silently become "other".
 *
 * @param warning - one warning from {@link validateEmphasis}
 * @returns the reason bucket
 */
export function classifyEmphasisWarning(warning: string): EmphasisDropReason {
  if (warning.includes("does not appear character-for-character")) return "notQuoted";
  if (warning.includes("probably half of")) return "compoundHalf";
  if (warning.includes("only function words")) return "functionWords";
  if (warning.includes("overlaps the longer") || warning.includes("replaces the shorter overlapping")) {
    return "overlap";
  }
  if (warning.includes("dropped duplicate")) return "duplicate";
  if (warning.includes("kept single syllable")) return "singleSyllable";
  if (warning.includes("re-cased")) return "recased";
  return "other";
}

/** Reasons that mean the phrase was thrown away, not merely noted. */
const DROPPING_REASONS: ReadonlySet<EmphasisDropReason> = new Set([
  "notQuoted",
  "compoundHalf",
  "functionWords",
  "overlap",
  "duplicate",
]);

/** How one word scored. */
export interface WordScore {
  word: string;
  level: string;
  /** Pass/fail per check, in {@link BENCH_CHECKS} order. */
  checks: Record<BenchCheck, boolean>;
  /** Weighted 0-100 for this word alone. */
  score: number;
  /** Human-readable reason for every failed check. */
  defects: string[];
  emphasisProposed: number;
  emphasisKept: number;
  /** Count per drop reason for this word. */
  emphasisDrops: Partial<Record<EmphasisDropReason, number>>;
}

/** How one model scored over the whole bench set. */
export interface ModelScore {
  words: number;
  /** Share of words that passed, per check. */
  rates: Record<BenchCheck, number>;
  /** Weighted 0-100 over all requested words. */
  score: number;
  emphasisProposed: number;
  emphasisKept: number;
  /** Share of proposed phrases that survived validation (1 when none proposed). */
  emphasisSurvival: number;
  emphasisDrops: Record<EmphasisDropReason, number>;
  perWord: WordScore[];
}

/** All checks false — used for a word the model never returned. */
function allFailed(): Record<BenchCheck, boolean> {
  return Object.fromEntries(BENCH_CHECKS.map((check) => [check, false])) as Record<
    BenchCheck,
    boolean
  >;
}

/** Weighted score of one check map. */
function weigh(checks: Record<BenchCheck, boolean>): number {
  let total = 0;
  for (const check of BENCH_CHECKS) {
    if (checks[check]) total += CHECK_WEIGHTS[check];
  }
  return total;
}

/**
 * Score one word.
 *
 * @param corpusWord - the word as requested (level comes from here, never the model)
 * @param annotation - what the model returned, or null when it returned nothing
 * @returns the per-word score with a reason for every failure
 */
export function scoreWord(
  corpusWord: CorpusWord,
  annotation: CrawlerAnnotation | null,
): WordScore {
  if (annotation === null) {
    return {
      word: corpusWord.word,
      level: corpusWord.level,
      checks: allFailed(),
      score: 0,
      defects: ["returned: no usable annotation came back for this word"],
      emphasisProposed: 0,
      emphasisKept: 0,
      emphasisDrops: {},
    };
  }

  const defects: string[] = [];
  const checks = allFailed();
  checks.returned = true;

  // 1. No English in the Vietnamese fields. The pipeline already empties an
  //    `anticipateVi` that leaks the answer, so an empty one is itself a fail.
  const viFields: Array<[string, string]> = [
    ["defVi", annotation.defVi],
    ["leadVi", annotation.leadVi],
    ["anticipateVi", annotation.anticipateVi],
  ];
  let leaks = 0;
  for (const [field, value] of viFields) {
    if (value.trim().length === 0) continue;
    if (containsTargetWord(value, annotation.word)) {
      leaks += 1;
      defects.push(`${field}: contains the English target "${annotation.word}"`);
    }
    // Vietnamese orthography cannot spell these tokens at all.
    const foreign = findForeignTokens(value);
    if (foreign.length > 0) {
      leaks += 1;
      defects.push(`${field}: not Vietnamese word(s): ${foreign.slice(0, 6).join(", ")}`);
    }
    // English that happens to fit the Vietnamese syllable pattern.
    const markers = findEnglishMarkers(value);
    if (markers.length > 0) {
      leaks += 1;
      defects.push(`${field}: English word(s) ${markers.join(", ")}`);
    }
  }
  checks.vietnameseOnly = leaks === 0;

  // 2. Diacritics. defVi is mandatory, so it carries the check.
  const ratio = diacriticRatio(annotation.defVi);
  checks.diacritics = ratio >= DIACRITIC_RATIO_FLOOR;
  if (!checks.diacritics) {
    defects.push(
      `defVi: only ${(ratio * 100).toFixed(0)}% of syllables carry a Vietnamese diacritic (floor ${(DIACRITIC_RATIO_FLOOR * 100).toFixed(0)}%)`,
    );
  }

  // 3. Complete Vietnamese sentences. An empty leadVi means the pipeline
  //    emptied a teaser whose noun was missing, or the model omitted it.
  const dangling = findDanglingDemonstrative(annotation.defVi);
  if (dangling !== null) {
    defects.push(`defVi: "${dangling}" leaves a quantifier without its noun`);
  }
  if (annotation.leadVi.trim().length === 0) {
    defects.push("leadVi: empty — omitted, or emptied because its noun was missing");
  }
  checks.completeSentence = dangling === null && annotation.leadVi.trim().length > 0;

  // 4+5. Emphasis: the clearest Vietnamese-competence signal in the contract.
  const emphasis = validateEmphasis({
    defVi: annotation.defVi,
    leadVi: annotation.leadVi,
    emphasisVi: annotation.emphasisVi,
  });
  const drops: Partial<Record<EmphasisDropReason, number>> = {};
  let droppedPhrases = 0;
  for (const warning of emphasis.warnings) {
    const reason = classifyEmphasisWarning(warning);
    drops[reason] = (drops[reason] ?? 0) + 1;
    if (DROPPING_REASONS.has(reason)) {
      droppedPhrases += 1;
      defects.push(`emphasisVi: ${warning.replace(/^emphasisVi: /u, "")}`);
    }
  }
  checks.emphasisWhole = annotation.emphasisVi.length > 0 && droppedPhrases === 0;
  if (annotation.emphasisVi.length === 0) {
    defects.push("emphasisVi: no phrases proposed");
  }
  checks.emphasisEnough = emphasis.emphasis.length >= 2;
  if (!checks.emphasisEnough) {
    defects.push(
      `emphasisVi: ${emphasis.emphasis.length} usable phrase(s) survived validation, the prompt asks for 2-4`,
    );
  }

  // 6. Prose length, exactly as the pipeline reports it.
  const prose = [
    ...checkVietnameseProse("defVi", annotation.defVi),
    ...checkVietnameseProse("leadVi", annotation.leadVi),
  ].filter((issue) => issue.includes("the prompt asks for"));
  checks.proseLength = prose.length === 0;
  defects.push(...prose);

  // 7+8. The example sentence pair.
  const blanks = annotation.usageEn.match(/_{3,}/gu) ?? [];
  checks.usageBlank = blanks.length === 1;
  if (!checks.usageBlank) {
    defects.push(`usageEn: ${blanks.length} blank(s), exactly one _____ is required`);
  }
  checks.usageVi = annotation.usageVi.trim().length > 0;
  if (!checks.usageVi) defects.push("usageVi: empty");

  // 9. The easy fields.
  const fieldProblems: string[] = [];
  if (!ALLOWED_POS.has(annotation.pos)) fieldProblems.push(`pos "${annotation.pos}"`);
  if (!ALLOWED_TOPICS.has(annotation.topic)) fieldProblems.push(`topic "${annotation.topic}"`);
  if (!/^\/.+\/$/u.test(annotation.ipa)) fieldProblems.push(`ipa "${annotation.ipa}"`);
  checks.fieldsValid = fieldProblems.length === 0;
  if (!checks.fieldsValid) defects.push(`fields outside the contract: ${fieldProblems.join(", ")}`);

  return {
    word: annotation.word,
    level: corpusWord.level,
    checks,
    score: weigh(checks),
    defects,
    emphasisProposed: annotation.emphasisVi.length,
    emphasisKept: emphasis.emphasis.length,
    emphasisDrops: drops,
  };
}

/** Every drop reason at zero, so a report never has holes. */
function zeroDrops(): Record<EmphasisDropReason, number> {
  return {
    notQuoted: 0,
    compoundHalf: 0,
    functionWords: 0,
    overlap: 0,
    duplicate: 0,
    singleSyllable: 0,
    recased: 0,
    other: 0,
  };
}

/**
 * Score a whole bench run for one model.
 *
 * Words the model did not return still count: they are scored 0, because a
 * model that drops a third of the batch is worse, not unmeasured.
 *
 * @param requested - the bench words, in request order
 * @param annotations - whatever the model returned, in any order
 * @returns aggregated rates plus the per-word detail
 */
export function scoreAnnotations(
  requested: readonly CorpusWord[],
  annotations: readonly CrawlerAnnotation[],
): ModelScore {
  const byWord = new Map(annotations.map((entry) => [entry.word, entry]));
  const perWord = requested.map((corpusWord) =>
    scoreWord(corpusWord, byWord.get(corpusWord.word) ?? null),
  );

  const rates = Object.fromEntries(
    BENCH_CHECKS.map((check) => [
      check,
      perWord.length === 0
        ? 0
        : perWord.filter((entry) => entry.checks[check]).length / perWord.length,
    ]),
  ) as Record<BenchCheck, number>;

  const emphasisDrops = zeroDrops();
  let emphasisProposed = 0;
  let emphasisKept = 0;
  for (const entry of perWord) {
    emphasisProposed += entry.emphasisProposed;
    emphasisKept += entry.emphasisKept;
    for (const [reason, count] of Object.entries(entry.emphasisDrops)) {
      emphasisDrops[reason as EmphasisDropReason] += count;
    }
  }

  let score = 0;
  for (const check of BENCH_CHECKS) score += rates[check] * CHECK_WEIGHTS[check];

  return {
    words: perWord.length,
    rates,
    score,
    emphasisProposed,
    emphasisKept,
    emphasisSurvival: emphasisProposed === 0 ? 1 : emphasisKept / emphasisProposed,
    emphasisDrops,
    perWord,
  };
}
