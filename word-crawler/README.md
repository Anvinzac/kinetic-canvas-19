# word-crawler

Standalone vocabulary crawler for the KineMedia WordCrawler feed. It turns an
openly licensed English word list (NGSL/NAWL, CC BY-SA 4.0) into a fully
annotated deck JSON (`meta` + `words`) that the main app imports.

Nothing here is published to npm and nothing imports the main app: a crawl
produces a deck **file**, and another agent/step copies that file downstream.

## Requirements

- Node.js >= 22.18.0 (runs TypeScript directly; no build step)
- An API key for one annotation provider, only for live crawls (tests and
  `--dry-run` need none): Anthropic, Together AI, OpenRouter, or any
  OpenAI-compatible endpoint

## Setup

```bash
cd word-crawler
npm install
cp .env.example .env   # fill in the key of the provider you crawl with
```

The admin Model page of the main app normally keeps Together/OpenRouter active
with `meta-llama/Llama-3.3-70B-Instruct-Turbo`; that is the profile the crawler
is usually pointed at (`--provider together`).

## Commands

```bash
# Crawl the bundled starter corpus and write a deck
npm run crawl -- --levels A1,A2 --batch 20 --output out/deck.json

# Update an existing deck in place: known words are kept and skipped
npm run crawl -- --resume out/deck.json

# Validate a deck before importing it downstream (exit 1 on errors)
npm run validate -- out/deck.json

# Compare how well several models write Vietnamese, on one frozen word set
npm run bench -- --models anthropic:claude-opus-5-5,together

# Import an official NGSL/NAWL download (CSV/TSV) into corpus JSON
npm run corpus:import -- --input ngsl.csv --output data/ngsl-full.json \
  --source ngsl --name "NGSL 1.2 (full)" \
  --license "CC BY-SA 4.0" \
  --license-url "https://creativecommons.org/licenses/by-sa/4.0/" \
  --attribution "Browne, C., Culligan, B., & Phillips, J. (2013). The New General Service List."

npm test         # 218 tests, mocked fetch, no network
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
| `--provider name` | `anthropic` (default) \| `together` \| `openrouter` \| `openai`; `$LLM_PROVIDER` decides when the flag is omitted |
| `--base-url url` | Provider root; required for `--provider openai` (e.g. a local llama.cpp server) |
| `--model name` | Model id (default: `$LLM_MODEL`, the provider's own env var, or the preset default — `claude-haiku-4-5-20251001`, `meta-llama/Llama-3.3-70B-Instruct-Turbo`, `meta-llama/llama-3.3-70b-instruct`) |
| `--temperature 0.4` | Sampling temperature 0–2, forwarded only to OpenAI-compatible providers |
| `--max-tokens 4000` | Response token budget per batch |
| `--timeout 290000` | Per-request timeout in ms (default 120000). Raise it for a reasoning model: its chain of thought is generated before the first character of the answer. Node's own `fetch` stops at 300000 regardless |
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
- **Trailing commas repaired.** `meta-llama/Llama-3.3-70B-Instruct-Turbo`
  intermittently closes a batch as `[ {…}, {…}, ]`, which is not JSON; two runs
  in three lost a whole 8-word batch to it. The extractor strips commas before
  a closing bracket as a last resort, skipping string contents so a comma
  inside a Vietnamese sentence is never touched.
- **Diagnosable failures.** A reasoning model whose chain of thought ate the
  whole `max_tokens` returns `finish_reason: length` with no content; that is
  reported as a cut-off reply, with the size of the reasoning and the advice to
  raise `--max-tokens`, rather than as a bare "no message content". A reply that
  is not JSON is quoted back in the error (an excerpt, both ends for a long
  one), because a model that malforms the same batch on every run cannot be
  diagnosed from a discarded reply.
- **Retries.** Only HTTP 429/500/504/529 (and transport errors) are retried, up
  to 4 attempts, with exponential backoff + jitter and `retry-after` honored.
  400/401/403/404 abort the whole run (fatal). Non-fatal batch failures skip that
  batch and keep going; the finished words are still written.

## Choosing an annotator model

`npm run bench` answers one question with numbers instead of impressions: of the
models this package can talk to, which one actually writes the Vietnamese the
feed needs? It sends **one frozen 24-word set** (`data/bench-sample.json`)
through the **identical** annotation prompt on every model, in identical
batches, and scores each run with the crawler's own checkers.

```bash
# Claude against the Llama profile the app's admin page usually runs
npm run bench -- --models anthropic:claude-opus-5-5,anthropic:claude-haiku-4-5,together

# Plan only: shows the batches and whether each model's key is present
npm run bench -- --models anthropic,together --dry-run
```

Keys come from the environment exactly as for `npm run crawl`. Each run prints a
scorecard and writes `out/bench-report.json`, which keeps the **raw Vietnamese**
and a per-word list of defects — the numbers are the summary, the report is the
evidence, and reading the actual sentences is still part of the job.

### The word set

The 24 words are not the most frequent ones; each is in the set because it
stresses one documented failure mode of the contract, and `meta.stressCases`
records the reason for every single one:

| Stress | Words | What breaks |
| --- | --- | --- |
| Classifier trap | thing, way, idea | the definition must point at a noun it is forbidden to name — the `những này` failure |
| Compound trap | man, woman, teacher, knowledge, environment, relationship, … | the natural Vietnamese is a 2–3 syllable unit (`người đàn ông`, `mối quan hệ`) that models cut in half |
| Loanword pressure | market, phone, data | Vietnamese has a real word, but the English one is what models reach for |
| Academic abstraction | concept, framework, hypothesis, phenomenon, research | stiff or wrong Vietnamese, and `giả thuyết` vs `giả thiết` is one diacritic apart |
| No concrete referent | enough, whereas, imply, perceive, arbitrary | an adverb, the corpus's only conjunction, and three abstract verbs |

The set is **frozen on purpose**: changing the words makes earlier reports
incomparable. `water` is excluded because it is the prompt's own worked example,
so a model that only copies the example would score well on it.

### What is scored

Every check is pass/fail per word, so a rate is always "share of the 24 words
that passed". Weights sum to 100 and live in `CHECK_WEIGHTS`:

| Check | Weight | Fails when |
| --- | --- | --- |
| `returned` | 15 | the word never came back (it then fails every other check too) |
| `vietnameseOnly` | 15 | `defVi`/`leadVi`/`anticipateVi` contains the English target, a token Vietnamese cannot spell, or an unambiguous English word — the same gate described under [Is it Vietnamese at all?](#is-it-vietnamese-at-all) |
| `diacritics` | 10 | fewer than 25% of `defVi`'s syllables carry a Vietnamese-only mark — accent-stripped Vietnamese parses as legal syllables and is still wrong |
| `completeSentence` | 15 | a quantifier lost its noun, or `leadVi` is empty |
| `emphasisWhole` | 15 | any proposed glow phrase was rejected by `validateEmphasis` — above all for cutting a compound in half |
| `emphasisEnough` | 5 | fewer than 2 phrases survive (the prompt asks for 2–4) |
| `proseLength` | 10 | `defVi` or `leadVi` falls outside 8–11 words |
| `usageBlank` | 5 | `usageEn` does not carry exactly one `_____` |
| `usageVi` | 5 | the Vietnamese translation is empty |
| `fieldsValid` | 5 | `pos`, `topic` or `ipa` is outside the contract |

No check is the bench's own: every one calls `checkVietnameseText`,
`checkVietnameseProse`, `findDanglingDemonstrative`, `containsTargetWord` or
`validateEmphasis` directly, so **a defect the bench counts is a defect the
crawl would have warned about or repaired**.

`emphasisWhole` is the check worth watching. Quoting 2–4 whole Vietnamese
vocabulary units character-for-character out of a sentence you just wrote
requires knowing where Vietnamese words end; the report breaks every rejected
phrase down by reason (`compoundHalf`, `notQuoted`, `functionWords`, `overlap`,
`duplicate`), which separates "does not know the word boundary" from "cannot
reproduce its own diacritics".

### Reading a result honestly

- **Run problems are printed separately.** A missing key, a failed batch or a
  reply that hit `max_tokens` is reported under *Run problems*, never silently
  scored as bad Vietnamese. Always read that section before believing a low
  score: a model that could not be called scores 0 on every check, and so does
  one whose answer never arrived.
- **Reasoning models need a big budget, or they score zero for the wrong
  reason.** A chain of thought is billed against `max_tokens`. Measured on an
  8-word batch, `zai-org/GLM-5.3` spent about **18,700 reasoning tokens before
  writing the first character** of its answer; at `--max-tokens 8000` the whole
  budget went to reasoning, the content came back empty, and the model scored
  0.0 — indistinguishable from terrible Vietnamese if you only read the total.
  That is why the default is now `--max-tokens 32000` with `--batch 8`, and why
  an empty reply after `finish_reason: length` now says so in the error instead
  of "no message content".
- **The score is close to a floor, not a ranking.** Measured on this set in
  October 2026, with every model returning all 24 words and no run problems:
  `deepseek-ai/DeepSeek-V4-Pro` and `moonshotai/Kimi-K3` **100.0**,
  `zai-org/GLM-5.3` 99.4, `openai/gpt-oss-120b` 98.5,
  `meta-llama/Llama-3.3-70B-Instruct-Turbo` 88.8. Four of five sit within 1.5
  points of each other, so the checks separate a model that cannot hold the
  contract from one that can and then saturate. Treat a score in the high 90s
  as "clears the bar" and judge between such models by reading the Vietnamese
  in the report, not by the totals.
- **One run is one sample.** These are sampled models; re-run before trusting a
  small gap, and compare the raw sentences in the report, not only the totals.
- **The score is a proxy.** It measures the Vietnamese rules this app's feed
  depends on, not Vietnamese in general.

## Contracts

### Crawler annotation (model output, pre-deck)

Exactly these ten fields — the model never assigns the CEFR level:

```
word, pos, ipa, defVi, leadVi, anticipateVi, usageEn, usageVi, topic, emphasisVi
```

The parser repairs what breaks the feed: an English target inside `usageEn` is
blanked to `_____`, an `anticipateVi` containing the answer is emptied, and a
`leadVi` whose noun was dropped ("những này") is emptied rather than published as
broken Vietnamese. A model-echoed `level` is stripped with a warning.
`checkVietnameseProse` additionally reports the rules the prompt asks for but a
model routinely misses (`defVi`/`leadVi` outside 8–11 words) — reported, never
silently rewritten — and `checkVietnameseText` reports any Vietnamese field that
is not actually Vietnamese (see below).

### Deck output (what downstream imports)

Top level: `{ "meta": {...}, "words": [...] }` — the existing WordCrawler shape
(`discoverPages`, `reversePages`, `wordCount`, …). `meta.corpus` records the full
provenance (path, name, version, kind, license, licenseUrl, derivedFrom, sources).

Per word:

```
id, word, pos, ipa, defVi, leadVi, anticipateVi, topic, level,
chars, initial, usage: [{ en, vi }], emphasis: string[]
```

`level` always comes from the corpus. `chars`/`initial` are derived.

Emphasis is written **twice on purpose**:

- inline `/phrase/` markers inside `defVi`/`leadVi` — the only format the feed
  reads (`parseEmphasisMarkers` in `src/features/vocabulary/lib/stages.ts` turns
  them into `stage.dataEmphasis`). The Vietnamese page highlights one phrase, so
  a field carries at most one marker;
- the `emphasis` array — the same validated phrases, which is what content-hub's
  deck reader sanitizes against (it strips the markers again when it loads a deck).

Both are guaranteed (by `validateEmphasis`, `injectEmphasisMarkers` and re-checked
by `validate`) to occur character-for-character in `defVi`/`leadVi` with
diacritics preserved. `validate` reports how many words carry a marker.

### Is it Vietnamese at all?

`src/vietnamese.ts` is the gate every stage enforces: the annotation parser
reports it per word during a crawl, `validate` reports it per deck before
import, and the bench scores it. One module, one rule, so a crawl and a bench
can never disagree about what counts as Vietnamese.

It is a **syllable validator**, not a word list. Vietnamese spelling is a closed
system — every syllable is `(onset)(nucleus)(coda)` drawn from fixed
inventories, with the tone mark on the nucleus — so a token that cannot be
parsed that way is not a Vietnamese word, whoever wrote it. `female`,
`knowledge` and `research` are caught without anybody listing them.

Three layers, because no single one is enough:

| Layer | Catches | Misses |
| --- | --- | --- |
| Syllable shape (`findForeignTokens`) | any token Vietnamese cannot spell — nearly all real English words | short English words that happen to fit the pattern: `the`, `man`, `can` |
| English markers (`findEnglishMarkers`) | exactly those — a seven-word list (`the`, `that`, `then`, `such`, `much`, `thing`, `thin`), every entry shape-valid and none a Vietnamese word | anything not on the list |
| Diacritic floor (`diacriticRatio`) | accent-stripped Vietnamese — `Chat long trong suot`, which parses as legal syllables and is still wrong | text with a few real diacritics and much else wrong |

Accent-stripped text usually trips two layers at once: most stripped syllables
stay legal shapes, but a stripped nucleus such as `uô` → `uo` is no Vietnamese
nucleus, so `suốt` → `suot` fails the shape check as well.

The marker list is kept to the seven words the shape check genuinely cannot
see, and a test fails if an entry is added that the shape check already catches
or that is a real Vietnamese word — `than` is coal, `them` is `thêm`, `man` is
`màn`, and `long`, `song`, `sang`, `tin` and `hang` are all Vietnamese.

The inventories are deliberately **generous**. Combinations that never occur in
real Vietnamese (`aic`) still parse, because over-accepting leaves good
Vietnamese alone while under-accepting would flag real content as foreign and
teach everyone to ignore the check. Only `f`, `j`, `w`, `z` and clusters alien
to Vietnamese are rejected outright. The test suite asserts this directly: every
token of a 23-sentence Vietnamese corpus must pass, and the existing live decks
in `out/` validate clean.

This catches leaks the older heuristics could not. On the October 2026 bench
run, `meta-llama/Llama-3.3-70B-Instruct-Turbo` wrote `Guess…` into
`anticipateVi` — a Vietnamese-only field — on two words. It is not the target
word, so the contract's answer-leak repair left it alone, and it is not on any
English word list; the syllable check caught it because Vietnamese cannot spell
`guess`.

Nothing here is repaired. A foreign token cannot be fixed without writing the
sentence again, so the crawl reports it per word, `validate` prints
`Vietnamese: N/M words …` and lists each one as a warning, and the bench counts
it against the model. Warnings, not errors: one odd token must not block a whole
deck, but it must never reach a learner unnoticed either.

### Vietnamese emphasis rules

A phrase is kept only when it occurs exactly (diacritics included) in `defVi` or
`leadVi`, is not made only of function words, is not a single syllable that
sits tight against a content syllable (half of a compound like `học sinh`), and
does not overlap a longer phrase already kept — the longer run wins, because the
model answers both `Khoảng thời gian` and `thời gian`. Ambiguous single syllables
are removed rather than trusted; every change is reported as a warning. Matching
never accent-strips (`nhưng` ≠ `những`).

What cannot be decided without a Vietnamese dictionary is **not** repaired here:
the feed's `repairSplitCompoundEmphasis` only heals an *orphan* syllable, so a
two-syllable fragment of a three-syllable compound (`người đàn` out of
`người đàn ông`) would glow broken. The prompt therefore demands whole vocabulary
units and the live runs are checked against that.

## Corpus provenance

The bundled corpus (`data/ngsl-starter-subset.json`) is a **starter subset of
381 words** curated from NGSL 1.2 (2809 words) and NAWL 1.2 (957 words) by
Browne, C., Culligan, B., & Phillips, J., both **CC BY-SA 4.0**. It is not the
official list and reproduces no official frequency rank; see `NOTICE.md` for the
full attribution and share-alike notice, and the corpus `meta` for details.

`data/bench-sample.json` is a frozen 24-word subset of that file, used only by
`npm run bench`; it inherits the same CC BY-SA 4.0 provenance and reproduces no
official ranking either.

For a full-size corpus, download an official list yourself and run
`npm run corpus:import`; data volume is a file, never a code change. Oxford
3000/5000 data is not present and must never be added (license does not permit
redistribution).

## Tests

Node's built-in test runner (`node --test`), no test framework dependency and no
network: both the Anthropic and the OpenAI-compatible clients are exercised
against a mocked `fetch` with injected `sleep`/`random`, and crawl runs use a
fake annotator plus temp directories inside the package. Coverage: bundled
corpus integrity and provenance, importer (headers, duplicates, band/level
mapping), deterministic dedupe/sort/filters, emphasis validation and marker
injection, annotation contract repair and Vietnamese prose checks, JSON
extraction, retry/backoff/fatal policy, provider resolution, deck
build/validate/round-trip, crawl resume/checkpoint/failure handling, CLI parsing,
the Vietnamese syllable validator (a 23-sentence real-prose corpus asserted
token by token against false positives, hard spellings pinned one by one,
English rejection, the accent-stripped cases), and the bench (scoring of every
check, the emphasis-reason classifier pinned against the real `validateEmphasis`
warnings, bench-corpus integrity and provenance, model-spec and flag parsing,
unrunnable-model reporting).
