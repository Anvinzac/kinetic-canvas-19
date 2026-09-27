# word-crawler

Standalone vocabulary crawler for the KineMedia WordCrawler feed. It turns an
openly licensed English word list (NGSL/NAWL, CC BY-SA 4.0) into a fully
annotated deck JSON (`meta` + `words`) that the main app imports.

Nothing here is published to npm and nothing imports the main app: a crawl
produces a deck **file**, and another agent/step copies that file downstream.

## Requirements

- Node.js >= 22.18.0 (runs TypeScript directly; no build step)
- An Anthropic API key only for live crawls (tests and `--dry-run` need none)

## Setup

```bash
cd word-crawler
npm install
cp .env.example .env   # fill in ANTHROPIC_API_KEY for live runs
```

## Commands

```bash
# Crawl the bundled starter corpus and write a deck
npm run crawl -- --levels A1,A2 --batch 20 --output out/deck.json

# Update an existing deck in place: known words are kept and skipped
npm run crawl -- --resume out/deck.json

# Validate a deck before importing it downstream (exit 1 on errors)
npm run validate -- out/deck.json

# Import an official NGSL/NAWL download (CSV/TSV) into corpus JSON
npm run corpus:import -- --input ngsl.csv --output data/ngsl-full.json \
  --source ngsl --name "NGSL 1.2 (full)" \
  --license "CC BY-SA 4.0" \
  --license-url "https://creativecommons.org/licenses/by-sa/4.0/" \
  --attribution "Browne, C., Culligan, B., & Phillips, J. (2013). The New General Service List."

npm test         # 100 tests, mocked fetch, no network
npm run typecheck
```

### `crawl` options

| Flag | Meaning |
| --- | --- |
| `--levels A1,A2` | Only crawl these CEFR levels (default: all) |
| `--batch 20` | Words per API request (default 20, max 50) |
| `--limit 100` | Stop after N words (smoke runs) |
| `--output out.json` | Deck file to write; required unless `--resume` is given |
| `--resume deck.json` | Keep + skip words from an existing deck |
| `--corpus file.json` | Corpus file (default: bundled starter subset) |
| `--model name` | Anthropic model (default `$ANTHROPIC_MODEL` or `claude-haiku-4-5-20251001`) |
| `--max-tokens 4000` | Response token budget per batch |
| `--name`, `--deck-version` | Deck meta fields |
| `--dry-run` | Plan batches only: no API calls, no files written |

### Reliability

- **Atomic output.** The deck is written to a sibling temp file and renamed, and
  only when the whole deck validates, so a crashed run never leaves partial JSON.
- **Resume without loss.** `--resume` re-validates the existing deck, keeps every
  usable word, and skips it during the crawl. Unrepresentable entries are warned
  about and re-crawled rather than silently dropped.
- **Checkpointing.** After each finished batch, words are appended to
  `<deck>.checkpoint.jsonl` (an internal sidecar, deleted after a clean write).
  Returning after a crash with the same `--output` picks the checkpoint up.
- **Retries.** Only HTTP 429/500/504/529 (and transport errors) are retried, up
  to 4 attempts, with exponential backoff + jitter and `retry-after` honored.
  400/401/403/404 abort the whole run (fatal). Non-fatal batch failures skip that
  batch and keep going; the finished words are still written.

## Contracts

### Crawler annotation (model output, pre-deck)

Exactly these ten fields — the model never assigns the CEFR level:

```
word, pos, ipa, defVi, leadVi, anticipateVi, usageEn, usageVi, topic, emphasisVi
```

The parser repairs the two leaks that break the feed: an English target inside
`usageEn` is blanked to `_____`, an `anticipateVi` containing the answer is
emptied. A model-echoed `level` is stripped with a warning.

### Deck output (what downstream imports)

Top level: `{ "meta": {...}, "words": [...] }` — the existing WordCrawler shape
(`discoverPages`, `reversePages`, `wordCount`, …). `meta.corpus` records the full
provenance (path, name, version, kind, license, licenseUrl, derivedFrom, sources).

Per word:

```
id, word, pos, ipa, defVi, leadVi, anticipateVi, topic, level,
chars, initial, usage: [{ en, vi }], emphasis: string[]
```

`level` always comes from the corpus. `chars`/`initial` are derived. `emphasis`
phrases are guaranteed (by `validateEmphasis` and re-checked by `validate`) to
occur character-for-character in `defVi`/`leadVi` with diacritics preserved.

### Vietnamese emphasis rules

A phrase is kept only when it occurs exactly (diacritics included) in `defVi` or
`leadVi`, is not made only of function words, and is not a single syllable that
sits tight against a content syllable (half of a compound like `học sinh`).
Ambiguous single syllables are removed rather than trusted; every change is
reported as a warning. Matching never accent-strips (`nhưng` ≠ `những`).

## Corpus provenance

The bundled corpus (`data/ngsl-starter-subset.json`) is a **starter subset of
381 words** curated from NGSL 1.2 (2809 words) and NAWL 1.2 (957 words) by
Browne, C., Culligan, B., & Phillips, J., both **CC BY-SA 4.0**. It is not the
official list and reproduces no official frequency rank; see `NOTICE.md` for the
full attribution and share-alike notice, and the corpus `meta` for details.

For a full-size corpus, download an official list yourself and run
`npm run corpus:import`; data volume is a file, never a code change. Oxford
3000/5000 data is not present and must never be added (license does not permit
redistribution).

## Tests

Node's built-in test runner (`node --test`), no test framework dependency and no
network: the Anthropic client is exercised against a mocked `fetch` with
injected `sleep`/`random`, and crawl runs use a fake annotator plus temp
directories inside the package. Coverage: bundled corpus integrity and
provenance, importer (headers, duplicates, band/level mapping), deterministic
dedupe/sort/filters, emphasis validator cases, annotation contract repair, JSON
extraction, retry/backoff/fatal policy, deck build/validate/round-trip, crawl
resume/checkpoint/failure handling, CLI parsing.
