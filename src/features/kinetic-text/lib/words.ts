/**
 * @responsibility Split text into whitespace-delimited tokens (kinetic word units).
 * @inputs Free-form status / canvas text
 * @outputs Non-empty token array; empty string → []
 * @pure true
 */
export function getWords(text: string) {
  return text.match(/\S+/g) ?? [];
}

/**
 * @responsibility Normalize a word into a DOM/data-attribute anchor key for stickers.
 * @inputs Single word token
 * @outputs Lowercased alphanumeric key (accents stripped)
 * @pure true
 */
export function getWordAnchorKey(word: string) {
  return word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "")
    .replace(/[^a-z0-9'-]/g, "");
}
