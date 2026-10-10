/**
 * Compile a WordCrawler deck into the served vocabulary data.
 *
 * Usage:
 *   npm run vocab:import -- <deck.json>                # rewrite the base catalog.json
 *   npm run vocab:import -- <deck.json> --pack <name>  # compile a read-only provider pack
 *                                                      #   → data/packs/<name>.json
 *   npm run vocab:import -- <deck.json> --pack <name> --staged
 *                                                      # compile a pack but keep it OUT of
 *                                                      #   the served feed: → data/packs/incoming/
 *
 * Both modes validate through normalizeDeck (which throws on a duplicate id, a leaked
 * answer or a malformed field) and write atomically via a temp file + rename, so the
 * previous file stays intact if anything fails. The feed merges catalog.json with every
 * data/packs/*.json at load time (lib/catalog-source.ts); packs never overwrite the
 * admin-editable base — on a shared id/headword the base wins.
 *
 * A `--staged` pack lands in `data/packs/incoming/`, one level below the
 * `data/packs/*.json` glob the loader globs (that pattern is non-recursive), so the words
 * are embedded in the repo and validated but stay invisible to the feed. Moving the file
 * up into `data/packs/` and rebuilding is the whole activation step — no code changes.
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeDeck } from "../src/features/vocabulary/lib/schema.ts";

const USAGE = "Usage: npm run vocab:import -- <WordCrawler JSON path> [--pack <name>]";

// Split off an optional `--pack <name>`; what remains must be exactly one deck path.
const argv = process.argv.slice(2);
// `--staged` is a modifier on `--pack`: write the compiled pack into the non-globbed
// incoming/ folder so it is embedded but not served. Pulled out first so it can't shift
// the `--pack` index below.
const staged = argv.includes("--staged");
if (staged) argv.splice(argv.indexOf("--staged"), 1);
// `--locale <code>` routes a pack into data/<code>/ — a separate deck served only on that
// language's domain (lib/target-language.ts), never merged into the English feed.
const localeAt = argv.indexOf("--locale");
let locale: string | undefined;
if (localeAt !== -1) {
  locale = argv[localeAt + 1];
  argv.splice(localeAt, locale ? 2 : 1);
  if (!locale || !/^(zh|ko|ja)$/.test(locale)) throw new Error("--locale must be zh, ko or ja");
}
const packAt = argv.indexOf("--pack");
let packName: string | undefined;
if (packAt !== -1) {
  packName = argv[packAt + 1];
  argv.splice(packAt, packName ? 2 : 1);
}
const source = argv[0];

/** Restrict a pack name to a filesystem-safe slug so a provider name can't escape data/packs. */
function packSlug(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) throw new Error(`Invalid pack name "${name}"; use letters, digits, - or _`);
  return slug;
}

if (!source || argv.length !== 1 || (packAt !== -1 && !packName)) {
  console.error(USAGE);
  process.exitCode = 1;
} else if (staged && !packName) {
  console.error("--staged only applies with --pack <name>; the base catalog is always served.");
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
    const slug = packName ? packSlug(packName) : null;
    const output = fileURLToPath(
      new URL(
        slug
          ? locale
            ? `../src/features/vocabulary/data/${locale}/${slug}.json`
            : `../src/features/vocabulary/data/packs/${staged ? "incoming/" : ""}${slug}.json`
          : "../src/features/vocabulary/data/catalog.json",
        import.meta.url,
      ),
    );
    await mkdir(dirname(output), { recursive: true });
    // The old file remains intact if validation or writing fails. Rename is atomic here.
    const temporary = `${output}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify({ revision, ...catalog }, null, 2)}\n`, {
      flag: "wx",
    });
    await rename(temporary, output);
    console.log(
      slug
        ? staged
          ? `Staged pack "${slug}": ${catalog.count} words; revision ${revision} → data/packs/incoming/${slug}.json. Embedded and validated, but NOT served — move it into data/packs/ and rebuild/restart to display.`
          : `Compiled pack "${slug}": ${catalog.count} words; revision ${revision} → data/packs/${slug}.json. Restart dev / rebuild to serve.`
        : `Imported ${catalog.count} distinct words; revision ${revision}. Rebuild/deploy to publish.`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Vocabulary import failed");
    process.exitCode = 1;
  }
}
