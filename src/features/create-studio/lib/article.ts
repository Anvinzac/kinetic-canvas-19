/**
 * Pure helpers for article.
 *
 * Exports: normalizeArticleUrl, getUrlHost, getArticleTitle
 * Depends on: none (leaf module)
 */
/**
 * normalizeArticleUrl helper
 * @param value - value argument
 * @returns Computed value
 */
export function normalizeArticleUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

/**
 * Extract a display host from a normalized article URL.
 * @param value - value argument
 * @returns Computed value
 */
export function getUrlHost(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "linked article";
  }
}

/**
 * Derive a short article title from the published status text.
 * @param text - text argument
 * @returns Computed value
 */
export function getArticleTitle(text: string): string {
  const sentence = text.replace(/\s+/g, " ").trim();
  if (!sentence) return "Linked article";
  return sentence.length > 72 ? `${sentence.slice(0, 69).trim()}...` : sentence;
}
