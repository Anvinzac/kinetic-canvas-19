/**
 * Feature flags — temporary vocab-only mode.
 *
 * When VOCAB_ONLY_MODE is true:
 *  - Home feed (getFeed) + Discover (getDiscover) only show vocabulary bot posts
 *    (do_chu_bot / wordcrawler deck). Other scheduled posts are paused at the
 *    DB layer (migration 20260723000000...), and existing non-vocab posts are
 *    hidden at the app layer here — no rows are deleted.
 *
 * To revert to full feed: set VOCAB_ONLY_MODE = false and re-activate the
 * other bot_agents (see bottom of that migration for the 2 SQL lines).
 */
export const VOCAB_ONLY_MODE = true;

/** Profile id of the vocabulary bot (do_chu_bot). Matches migration 20260621083000... */
export const VOCAB_BOT_PROFILE_ID = "77777777-7777-4777-8777-777777777777";

/** Return true if a post looks like a vocabulary reveal (duck-typing for safety). */
export function isVocabularyPost(post: { author_id: string; canvas_html: string }): boolean {
  if (post.author_id === VOCAB_BOT_PROFILE_ID) return true;
  // Fallback: legacy vocab posts are identified by the two hint substrings.
  // Keep in sync with public.vocabulary_reveal_word_from_canvas().
  const html = post.canvas_html ?? "";
  return html.includes("Từ này bắt đầu bằng chữ") && html.includes("Cả từ gồm");
}
