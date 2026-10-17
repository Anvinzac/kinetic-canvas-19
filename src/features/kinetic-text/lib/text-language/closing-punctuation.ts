/**
 * The one definition of "closing punctuation that rides on the end of a word".
 *
 * This concept used to be re-typed at each site that needed it — four times in the page
 * splitter, once in the phrase-edge detector, once in the compound joiner — and the
 * copies disagreed. The line layout knew about typographic quotes; the PAGE splitter
 * listed only ASCII `" ' ) ]`. A Vietnamese deck writes `“Đừng kể với ai nhé.”`, so the
 * full stop ended the sentence, the `”` was not allowed to ride along, and it became a
 * sentence — and then a whole scene — of its own.
 *
 * Nothing here is a list of characters anyone has to remember: `\p{Pf}` is Unicode's
 * Final_Punctuation (`” ’ »`), `\p{Pe}` its Close_Punctuation (`) ] } 」 』`), and the
 * two straight quotes are Other_Punctuation, so they are named explicitly. An opening
 * quote is deliberately NOT here: it introduces what follows and belongs to the next
 * word, never the previous one.
 *
 * Exports: CLOSING_PUNCTUATION_CLASS, endsWithPunctuation
 * Depends on: none (leaf module)
 */

/** Regex class source for one closing mark. Composed into patterns, never used alone. */
export const CLOSING_PUNCTUATION_CLASS = `["'\\p{Pf}\\p{Pe}]`;

/**
 * A pattern matching a word that ends with one of `lead`'s marks, through any run of
 * closing punctuation after it.
 * @param lead - regex source for the mark(s) that end the word, e.g. `"[,.;]"`
 * @returns An anchored, Unicode-aware pattern
 * @pure true
 */
export function endsWithPunctuation(lead: string): RegExp {
  return new RegExp(`(?:${lead})${CLOSING_PUNCTUATION_CLASS}*$`, "u");
}
