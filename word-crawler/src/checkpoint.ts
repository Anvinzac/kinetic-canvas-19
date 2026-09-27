/**
 * Checkpoint store — crash-safe progress for long crawls.
 *
 * Responsibility: append every finished deck word to a JSONL sidecar file the
 * moment its batch completes, so a crashed or rate-limited run can be resumed
 * without paying for the same words twice. The sidecar is deleted only after
 * the final deck has been written atomically.
 *
 * The final artifact is always plain deck JSON; JSONL is an internal detail.
 *
 * Exports: checkpointPathFor, appendCheckpointWords, readCheckpointWords
 * Depends on: node:fs, node:fs/promises, node:path, ./deck.ts
 */
import { readFileSync } from "node:fs";
import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { toDeckWord, type DeckWord } from "./deck.ts";

/**
 * Sidecar path for one output deck.
 * @param outputPath - deck path chosen with --output
 * @returns `<deck>.checkpoint.jsonl`
 */
export function checkpointPathFor(outputPath: string): string {
  return `${outputPath}.checkpoint.jsonl`;
}

/**
 * Append finished deck words to the checkpoint, one JSON object per line.
 * A crash can only damage the last line, and the reader skips damaged lines.
 *
 * @param path - checkpoint path
 * @param words - deck words completed in the latest batch
 */
export async function appendCheckpointWords(
  path: string,
  words: readonly DeckWord[],
): Promise<void> {
  if (words.length === 0) return;
  await mkdir(dirname(path), { recursive: true });
  const lines = `${words.map((word) => JSON.stringify(word)).join("\n")}\n`;
  await appendFile(path, lines, "utf8");
}

/**
 * Read checkpoint words, skipping anything unreadable.
 *
 * @param path - checkpoint path (a missing file is not an error)
 * @returns valid deck words plus warnings for skipped lines
 */
export function readCheckpointWords(path: string): { words: DeckWord[]; warnings: string[] } {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return { words: [], warnings: [] };
  }

  const words: DeckWord[] = [];
  const warnings: string[] = [];
  text.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed) as unknown;
    } catch {
      warnings.push(`checkpoint line ${index + 1}: not valid JSON, skipped`);
      return;
    }
    const deckWord = toDeckWord(parsed);
    if (deckWord === null) {
      warnings.push(`checkpoint line ${index + 1}: not a usable deck word, skipped`);
      return;
    }
    words.push(deckWord);
  });
  return { words, warnings };
}
