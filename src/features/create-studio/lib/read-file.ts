/**
 * Pure helpers for read file.
 *
 * Exports: readFileAsDataUrl
 * Depends on: none (leaf module)
 */
/**
 * readFileAsDataUrl helper
 * @param file - file argument
 * @returns Computed value
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
