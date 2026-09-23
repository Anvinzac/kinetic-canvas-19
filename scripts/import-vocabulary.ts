/** Compile a WordCrawler deck into the server catalog. Usage: npm run vocab:import -- <file.json>. */
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeDeck } from "../src/features/vocabulary/lib/schema.ts";

const source = process.argv[2];
if (!source || process.argv.length !== 3) {
  console.error("Usage: npm run vocab:import -- <WordCrawler JSON path>");
  process.exitCode = 1;
} else {
  try {
    const input = resolve(source);
    if ((await stat(input)).size > 100 * 1024 * 1024)
      throw new Error("Deck exceeds the 100 MiB import limit");
    const catalog = normalizeDeck(JSON.parse(await readFile(input, "utf8")));
    const revision = createHash("sha256")
      .update(JSON.stringify(catalog))
      .digest("hex")
      .slice(0, 24);
    const output = fileURLToPath(
      new URL("../src/features/vocabulary/data/catalog.json", import.meta.url),
    );
    await mkdir(dirname(output), { recursive: true });
    // The old catalog remains intact if validation or writing fails. Rename is atomic on this filesystem.
    const temporary = `${output}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify({ revision, ...catalog }, null, 2)}\n`, {
      flag: "wx",
    });
    await rename(temporary, output);
    console.log(
      `Imported ${catalog.count} distinct words; revision ${revision}. Rebuild/deploy to publish.`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Vocabulary import failed");
    process.exitCode = 1;
  }
}
