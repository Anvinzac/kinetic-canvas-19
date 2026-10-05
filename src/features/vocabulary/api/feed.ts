/** Anonymous browser fetch adapter. Exports: fetchVocabularyPage, VocabularyRequestError. Depends on: transport types, backfill bounds. */
import { VOCAB_PAGE_LIMIT } from "../lib/backfill";
import type { FeedCursor, FeedPage, VocabularyFilters } from "../types";

export class VocabularyRequestError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "VocabularyRequestError";
    this.code = code;
  }
}

/** Request one abortable page without auth headers. @param input Stream/cursor context. @returns The server page. */
export async function fetchVocabularyPage(input: {
  seed: string;
  filters: VocabularyFilters;
  cursor: FeedCursor;
  signal: AbortSignal;
}): Promise<FeedPage> {
  const query = new URLSearchParams({
    seed: input.seed,
    topic: input.filters.topic,
    level: input.filters.level,
    difficulty: input.filters.difficulty,
    position: String(input.cursor.position),
    limit: String(VOCAB_PAGE_LIMIT),
    ...(input.cursor.revision ? { revision: input.cursor.revision } : {}),
  });
  const controller = new AbortController();
  const abort = () => controller.abort();
  input.signal.addEventListener("abort", abort, { once: true });
  if (input.signal.aborted) controller.abort();
  const timeout = setTimeout(abort, 15_000);
  try {
    const response = await fetch(`/api/public/vocabulary?${query}`, {
      signal: controller.signal,
      credentials: "omit",
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new VocabularyRequestError(
        body.error || "Could not load more words. Please retry.",
        body.code || "UNAVAILABLE",
      );
    }
    return (await response.json()) as FeedPage;
  } finally {
    clearTimeout(timeout);
    input.signal.removeEventListener("abort", abort);
  }
}
