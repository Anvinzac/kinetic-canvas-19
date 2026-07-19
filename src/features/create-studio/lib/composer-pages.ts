/**
 * Pure helpers for composer pages.
 *
 * Exports: MAX_STATUS_CHARS, getComposerPages, limitComposerPages, joinComposerPages
 * Depends on: none (leaf module)
 */
export const MAX_STATUS_CHARS = 220;

/**
 * Split composer text into page strings on newlines.
 * @param text - text argument
 * @returns Computed value
 */
export function getComposerPages(text: string): string[] {
  const pages = text.replace(/\r\n?/g, "\n").split("\n");
  return pages.length > 0 ? pages : [""];
}

/**
 * Clip page strings so joined length stays within MAX_STATUS_CHARS.
 * @param pages - pages argument
 * @returns Computed value
 */
export function limitComposerPages(pages: string[]): string[] {
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
 * Join pages with newlines after enforcing the char budget.
 * @param pages - pages argument
 * @returns Computed value
 */
export function joinComposerPages(pages: string[]): string {
  return limitComposerPages(pages).join("\n");
}
