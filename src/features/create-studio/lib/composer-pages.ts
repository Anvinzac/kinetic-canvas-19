/**
 * @responsibility Max characters allowed across joined composer pages (incl. newlines).
 */
export const MAX_STATUS_CHARS = 220;

/**
 * @responsibility Split composer text into page strings on newlines.
 * @pure true
 */
export function getComposerPages(text: string) {
  const pages = text.replace(/\r\n?/g, "\n").split("\n");
  return pages.length > 0 ? pages : [""];
}

/**
 * @responsibility Clip page strings so joined length stays within MAX_STATUS_CHARS.
 * @pure true
 */
export function limitComposerPages(pages: string[]) {
  const limited: string[] = [];
  let used = 0;

  pages.forEach((page, index) => {
    const separatorSize = index === 0 ? 0 : 1;
    const remaining = MAX_STATUS_CHARS - used - separatorSize;
    if (remaining <= 0) return;

    const clipped = page.slice(0, remaining);
    if (index > 0) used += 1;
    used += clipped.length;
    limited.push(clipped);
  });

  return limited.length > 0 ? limited : [""];
}

/**
 * @responsibility Join pages with newlines after enforcing the char budget.
 * @pure true
 */
export function joinComposerPages(pages: string[]) {
  return limitComposerPages(pages).join("\n");
}
