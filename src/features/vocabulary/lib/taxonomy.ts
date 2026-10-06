/**
 * The two curated axes a vocabulary word is grouped by, beside its CEFR level.
 *
 * `topic` used to be one freeform slug per word, which could not say that a word
 * belongs to both working life and academic writing. Both axes are multi-valued
 * and closed: a reviewer picks from these lists, so a typo cannot silently create
 * a ninth topic that no filter will ever show again.
 *
 * Exports: TOPICS, TOPIC_IDS, TopicId, getTopic, isTopicId,
 *   EXAMS, EXAM_IDS, ExamId, getExam, isExamId
 * Depends on: none
 */

/** Usage domains, in the order they are offered to a reviewer. */
export const TOPICS = [
  { id: "daily", vi: "Hằng ngày", en: "Daily life" },
  { id: "work", vi: "Công việc", en: "Work" },
  { id: "study", vi: "Học thuật", en: "Academic" },
  { id: "communication", vi: "Giao tiếp", en: "Communication" },
  { id: "thinking", vi: "Tư duy", en: "Thinking" },
  { id: "emotion", vi: "Cảm xúc", en: "Emotion" },
  { id: "character", vi: "Tính cách", en: "Character" },
  { id: "attention", vi: "Chú ý", en: "Attention" },
  { id: "perception", vi: "Cảm nhận", en: "Perception" },
  { id: "time", vi: "Thời gian", en: "Time" },
  { id: "money", vi: "Tiền bạc", en: "Money" },
  { id: "health", vi: "Sức khỏe", en: "Health" },
  { id: "travel", vi: "Di chuyển", en: "Travel" },
  { id: "food", vi: "Ăn uống", en: "Food" },
  { id: "nature", vi: "Thiên nhiên", en: "Nature" },
  { id: "technology", vi: "Công nghệ", en: "Technology" },
  { id: "society", vi: "Xã hội", en: "Society" },
  { id: "general", vi: "Chung", en: "General" },
] as const;

export type TopicId = (typeof TOPICS)[number]["id"];

export const TOPIC_IDS = TOPICS.map((topic) => topic.id) as [TopicId, ...TopicId[]];

/**
 * Look a usage domain up by id.
 * @param id - candidate topic slug
 * @returns The topic, or undefined for a slug outside the curated set
 * @pure true
 */
export function getTopic(id: string) {
  return TOPICS.find((topic) => topic.id === id);
}

/**
 * Whether a slug is a curated usage domain.
 * @param id - candidate topic slug
 * @returns True when the slug is offered
 * @pure true
 */
export function isTopicId(id: string): id is TopicId {
  return TOPICS.some((topic) => topic.id === id);
}

/** Exam and competition targets a word can be prepared for. */
export const EXAMS = [
  { id: "toeic", vi: "TOEIC", en: "TOEIC" },
  { id: "ielts", vi: "IELTS", en: "IELTS" },
  { id: "toefl", vi: "TOEFL", en: "TOEFL" },
  { id: "vstep", vi: "VSTEP", en: "VSTEP" },
  { id: "cambridge", vi: "Cambridge", en: "Cambridge (KET/PET/FCE)" },
  { id: "sat", vi: "SAT", en: "SAT" },
  { id: "gre", vi: "GRE", en: "GRE" },
] as const;

export type ExamId = (typeof EXAMS)[number]["id"];

export const EXAM_IDS = EXAMS.map((exam) => exam.id) as [ExamId, ...ExamId[]];

/**
 * Look an exam target up by id.
 * @param id - candidate exam slug
 * @returns The exam, or undefined for a slug outside the curated set
 * @pure true
 */
export function getExam(id: string) {
  return EXAMS.find((exam) => exam.id === id);
}

/**
 * Whether a slug is a curated exam target.
 * @param id - candidate exam slug
 * @returns True when the slug is offered
 * @pure true
 */
export function isExamId(id: string): id is ExamId {
  return EXAMS.some((exam) => exam.id === id);
}
