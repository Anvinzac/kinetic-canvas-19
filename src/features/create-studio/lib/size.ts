/**
 * @responsibility Suggest a smaller type size when the focused page text grows long.
 * @pure true
 */
export function suggestSize(text: string, current: number) {
  const clean = text.trim();
  if (!clean) return current;
  if (clean.length > 150) return Math.min(current, 72);
  if (clean.length > 90) return Math.min(current, 84);
  if (clean.length > 48) return Math.min(current, 96);
  return current;
}
