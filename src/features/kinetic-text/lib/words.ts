/**
 * Pure helpers for words.
 *
 * Exports: getWords, getWordAnchorKey
 * Depends on: none (leaf module)
 */
/**
 * Compute words.
 * @param text - text argument
 * @returns Computed value
 */
export function getWords(text: string): string[] {
  return text.match(/\S+/g) ?? [];
}

/**
 * Normalize a word into a DOM/data-attribute anchor key for stickers.
 * @param word - word argument
 * @returns Lowercased alphanumeric key (accents stripped)
 */
export function getWordAnchorKey(word: string): string {
  return word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "")
    .replace(/[^a-z0-9'-]/g, "");
}
