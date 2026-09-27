/**
 * JSON file helpers — one place for safe, atomic writes.
 *
 * Responsibility: read JSON with readable errors and write JSON without ever
 * leaving a half-written file behind. The deck writer and the corpus importer
 * both use this module.
 *
 * Exports: JsonFileError, readJsonFile, writeJsonAtomic, removeFileIfExists
 * Depends on: node:crypto, node:fs, node:fs/promises, node:path
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, rename, rm, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/** Raised when a JSON file cannot be read, parsed, or replaced. */
export class JsonFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JsonFileError";
  }
}

/**
 * Read and parse a JSON file.
 * @param path - file to read
 * @returns parsed JSON value (typed by the caller)
 * @throws JsonFileError with the underlying reason
 */
export function readJsonFile(path: string): unknown {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new JsonFileError(`Cannot read ${path}: ${reason}`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new JsonFileError(`${path} is not valid JSON`);
  }
}

/**
 * Write a JSON file atomically: sibling temp file + rename.
 *
 * A crash can therefore never leave a truncated deck in place — readers see
 * either the previous file or the complete new one.
 *
 * @param path - destination path
 * @param value - JSON-serializable value
 * @param options.indent - pretty-print indentation (default 2)
 * @returns the destination path
 */
export async function writeJsonAtomic(
  path: string,
  value: unknown,
  options: { indent?: number } = {},
): Promise<string> {
  const indent = options.indent ?? 2;
  const temporary = `${path}.${randomUUID()}.tmp`;
  await mkdir(dirname(path), { recursive: true });
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, indent)}\n`, { flag: "wx" });
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    const reason = error instanceof Error ? error.message : String(error);
    throw new JsonFileError(`Cannot write ${path}: ${reason}`);
  }
  return path;
}

/**
 * Delete a file if it exists (checkpoints are removed after a successful write).
 * @param path - file to delete
 */
export async function removeFileIfExists(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;
  }
}
