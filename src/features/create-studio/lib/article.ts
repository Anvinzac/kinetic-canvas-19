/**
 * @responsibility Normalize user-entered article URLs to absolute http(s) or empty.
 * @pure true
 */
export function normalizeArticleUrl(value: string) {
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
 * @responsibility Extract a display host from a normalized article URL.
 * @pure true
 */
export function getUrlHost(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "linked article";
  }
}

/**
 * @responsibility Derive a short article title from the published status text.
 * @pure true
 */
export function getArticleTitle(text: string) {
  const sentence = text.replace(/\s+/g, " ").trim();
  if (!sentence) return "Linked article";
  return sentence.length > 72 ? `${sentence.slice(0, 69).trim()}...` : sentence;
}
