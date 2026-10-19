# HANDOFF: teach the reader what `=` and `|` mean

**For:** whoever implements the rendering side in this repo.
**Companion to:** `word-joiner-generation-handoff.md`, which tells a generator how to _write_
the marks. This document is about what to _do_ with them.

**Status in one line:** `_` and `=` are honoured by the reader — a bonded group is never
split. The phrase rule (§3) is implemented for lines and pages, and already applies to the
reader's own equivalents of `|`: a word ending in `,` `.` or `;`. `|` is authored, validated
and safely stripped, but its positions do not reach the layout yet (§4, Steps 1–2). That is
the remaining job.

---

## 1. The three marks

Deck text carries three invisible marks. They exist because Vietnamese is written one
syllable at a time, so nothing in the text itself says where a word ends or where a phrase
ends, and a line break lands wherever it fits.

| Mark | Means                         | May a line break here? | May a highlight span it? |
| ---- | ----------------------------- | ---------------------- | ------------------------ |
| `_`  | these syllables are ONE word  | never                  | **yes** — it is one word |
| `=`  | these two words lean together | never                  | **no**                   |
| `\|` | edge between two phrases      | **preferred**          | no                       |

```
Chất_lỏng trong suốt | mà ta uống=mỗi ngày.
```

The reader also treats a word that ends in a **comma, full stop, semicolon, question mark,
exclamation mark or ellipsis** (`,` `.` `;` `?` `!` `…`, possibly inside closing quotes) as a
phrase edge: its own equivalent of `|`, read from text
that has no marks at all. This is a reading rule only; it asks nothing new of a generator.
A mark inside a word or number (`1.000`) is not at its end and makes no edge, and the end of
a page is not an edge.

The three sentence-final marks (`?` `!` `…`) were missing from this list at first, and `?` was
even asserted not to count — which is backwards, since a question mark closes a phrase more
definitely than a comma does. Without them a line could end one word past a sentence
(`Bạn có nghe / không? Tôi / ngồi đây`), dragging the next sentence's first word onto this
one. A colon stays out on purpose: a Vietnamese colon introduces what follows.

None of the three marks reaches a reader, and none changes a word count: every "N words" rule
counts syllables as if the marks were spaces. `countJoinedUnits()` is that count.

The levels are the prosodic hierarchy's: `_` is the prosodic word, `=` is the clitic group,
`|` is the phonological phrase. `=` is the Leipzig glossing rules' clitic boundary and `|`
the usual prosodic phrase boundary, so both will look familiar to a linguist.

## 2. What already works — do not rebuild it

`src/features/vocabulary/lib/word-joiner.ts` handles encoding, and
`scripts/check-word-joiners.ts` covers it (`npm run check:word-joiners`, 8 checks).

- `encodeWordJoiners()` turns `_` and `=` into a NO-BREAK SPACE (or a WORD JOINER between
  two Han glyphs) and **strips `|` entirely**. It runs once, where a catalog enters the app
  (`withWordJoiners` in `catalog-source.ts`). It is idempotent.
- `splitWordJoiners()` returns `{ text, bound }` — plain text plus each bonded group. Both
  `_` and `=` land in `bound`.
- `stages.ts` puts `bound` on each stage as `boundPhrases`, which reaches
  `WordSequenceText` and becomes `phraseKeys` for the packer. A bonded group is therefore
  already **one unbreakable segment**: it moves to the next line whole rather than leaving a
  syllable behind.

The lines a reader actually sees are chosen by the **measured layout**:
`useMeasuredLines` (`src/features/post-player/hooks/useMeasuredLines.ts`) measures every
segment as drawn and `solveMeasuredLines`
(`src/features/kinetic-text/lib/text-language/measured-lines.ts`) tries every arrangement of
them. It builds its segments from the same `phraseKeys`, so a bonded group is one measured
segment there too, and a break can only ever fall _between_ segments. The character-count
packer (`getVietnameseWordLines`) only seeds the first, unseen measuring pass, and is the
fallback where the measured layout does not run (more than `MAX_MEASURED_SEGMENTS` = 15
segments on a page, Han pages, community posts).

So `=` needs nothing further for layout. **Its one open question is emphasis** — see §6.

`splitPhrases()` exists and returns the phrases of a text, but nothing calls it.

## 3. The display rule

The marks are instructions from the model that wrote the text, and the reader follows
them in a fixed order. The first two are hard; nothing below them may override them.

1. **Never break inside a `_` or `=` group.** The generator marked those syllables as
   inseparable, so they are one segment: if a segment does not fit at the end of a line it
   moves to the next line **whole**, and if it does not fit on any line the page is set
   smaller. This is already enforced (§2).
2. **Never leave the box.** Every line is measured and must fit its line width at the size
   the page is set in. Already enforced.
3. **Honour the phrase edges — `|`, and a word ending in `,` `.` `;` `?` `!` `…`.** A break is welcome
   right **after** an edge, and **never one word away from it**: a line or page must not end
   one word after the mark, nor begin with the one word that carries it. See "How strong"
   for the one escape the layout keeps.
4. Then the measured layout's existing preferences: the largest type, no stranded scrap of
   a word, even lines.

Rule 3, exactly, for a line or page break before word `b`, with `e` any edge (the index of
the first word after the mark):

> If `b` is before `e`, at least **two** words lie between `b` and `e` — so the next line
> does not begin with the one word that carries the mark.
> If `b` is after `e`, the words between `e` and `b` are **not exactly one** — so the line
> does not end one word after the mark.

A _word_ here is what moves as one unit: a single syllable, a `_` word and a `=` pair each
count once, and a mark standing on its own counts as nothing. (A `=` pair is two words to a linguist, but
once a deck is loaded the reader cannot tell it from a `_` word, and counting it once is
the stricter choice.) The start and end of the page are **not** edges: a page that ends on
a lone word is the scrap penalty's business, not this rule's.

Two failures, both of which the rule forbids:

**Stranding.** The line breaks one word before the mark, so the last word of a phrase
starts the next line on its own.

```
Chất lỏng trong
suốt mà ta uống mỗi ngày.         ← bad: "suốt" is cut off from the first phrase
```

**Poaching.** The line runs one word past the mark to fill its width.

```
Chất lỏng trong suốt mà           ← bad: "mà" is cut off from the second phrase
ta uống mỗi ngày.
```

With a comma, the same two failures:

```
Mở cửa                  Mở cửa ra, ồ
ra, ồ đẹp quá!          đẹp quá!
```

The reader sets this page as `Mở cửa ra, / ồ đẹp quá!` (asserted in
`scripts/check-measured-lines.ts`). Every failure is a word cut off from its phrase, and a
break exactly on an edge always avoids it.

### How the rules interact

- **Rule 1 decides where a break can be; rule 3 only chooses among those places.** The
  layout never considers a position inside a bonded group, so it never weighs a phrase
  edge against a bond. Do not "fix" a phrase violation by splitting a `_` or `=` group.
- **Rule 3 is not always satisfiable.** With a single word between two marks
  (`A, B, C`), a break after either comma leaves `B` one word from the other. The layout then
  weighs a violation against a smaller page; it never breaks a bond.
- **Rule 3 and the scrap penalty are different tests.** The scrap penalty is about width (a
  lone word much narrower than its neighbours). Rule 3 is about distance from a mark, and
  applies even when the word is wide.
- **Rule 3 applies only to phrased text** — a page with at least one `|`, or a `,` `.` `;` `?` `!` `…` inside it.
  Unmarked text carries no phrase information, so it changes nothing there: pages without
  edges lay out exactly as they did before (asserted).

### How strong

A phrase is not a bound group. A long phrase _must_ be allowed to split, or an 11-syllable
sentence with one `|` would be two unwrappable blocks. So rule 3 only forbids the breaks
next to a mark, and it is a weight in the solver's score rather than a bar, so that a page
that cannot be set any other way still gets set:

- a break one word from a mark multiplies the score by `0.45` (`PHRASE_SPLIT_FACTOR`), so
  the layout takes one only when every arrangement without one would have to be set at
  less than about half the size. On 36 real clue pages with a comma or full stop inside,
  portrait and landscape, it never had to;
- any other break inside a phrase multiplies it by `0.98` (`INSIDE_PHRASE_FACTOR`), so a
  break on the edge itself wins whenever the sizes are close.

## 4. Where the code goes

### Step 1 — carry the edges, as word indices

Steps 1 and 2 are only for `|`. Punctuation needs neither: it is still in the page's text
when the layout runs, and the layout finds it there (Step 3).

**The trap:** `encodeWordJoiners()` strips `|` — and it runs **when the catalog loads**
(`withWordJoiners` in `catalog-source.ts`), so the mark is already gone when `buildStages`
first sees the text. Derive the positions while the mark is still there — in `encodeWord`,
from each field before it is encoded — and carry them on the loaded word beside the text.

Express edges as **word indices into `getWords(text)`**, not as strings. `getWords` splits
on `/\S+/`, and a NO-BREAK SPACE counts as whitespace there, so **one word = one syllable**
even inside a bonded group. Phrase k's edge index is the running total of syllables in
phrases 0…k-1. `/…/` highlight marks do not change the count; they ride on their words.

```ts
// word-joiner.ts
export function getPhraseEdges(text: string): number[] {
  const edges: number[] = [];
  let total = 0;
  for (const phrase of splitPhrases(text)) {
    if (total > 0) edges.push(total);
    total += phrase.split(/\s+/).filter(Boolean).length;
  }
  return edges; // e.g. [4] for "Chất_lỏng trong suốt | mà ta uống=mỗi ngày."
}
```

### Step 2 — put them on the stage, per page

`stages.ts`'s `parseEmphasisMarkers()` already returns `{ clean, markers, bound }`. Add
`edges` beside them and set `phraseEdges` on the stage next to `boundPhrases`, for every
field that gets the treatment (`defVi`, `leadVi`, `anticipateVi`, `usage[].vi`).

**Second trap: pages.** `buildStages` paginates each stage afterwards and copies the stage
onto every page (`{ ...stage, id, text }`). A long field does become several pages —
`paginateText` splits a long sentence at clause boundaries — so word indices from the
whole field are wrong on page two. When a stage is paginated, shift its edges by the
page's first word index and keep only those that fall inside the page. A page boundary
that lands on an edge simply drops that edge; it is already a break. Keep "phrased, no edge
on this page" (an empty list) distinct from "not phrased" (no list): a page that sits
inside one long phrase still has to follow rule 3, and an unmarked field must not.

Then thread `phraseEdges` through `VocabularyStage` → `WordSequenceText` exactly as
`boundPhrases` is threaded.

### Step 3 — teach the measured layout (done)

`src/features/kinetic-text/lib/text-language/measured-lines.ts`:

- `solveMeasuredLines(segments, bounds, { phraseEdges })` takes the edges as word indices.
  `getBreakFactors` turns them into one factor per gap between segments, and the loop over
  arrangements multiplies in the factor of every break it makes, beside the lone-word
  penalty. Each segment carries its words' indices, so nothing else is needed.
- `getPunctuationPhraseEdges(words)` returns the edges a page's own `,` `.` `;` `?` `!` `…` make, and
  `isBreakOneWordFromEdge(words, edges, at)` applies rule 3 to a break between single
  tokens, for callers that do not have segments.
- `WordSequenceText` derives those edges from the page's tokens and passes them through
  `useMeasuredLines`, where they are a dependency of the solve but **not** part of the
  measurement signature: edges change the breaks, not how wide anything is drawn.

To bring `|` in, merge the page's carried `phraseEdges` (Steps 1–2) with the punctuation edges in
`WordSequenceText`. Nothing in the solver changes.

### Step 4 — the fallback packer

`getVietnameseWordLines` in `page-metrics.ts` still produces the lines for the cases the
measured layout skips (§2). Give it the same rule as a soft preference:

Add to `VietnameseLineLayoutOptions` (in `types.ts`):

```ts
/** Word indices at which a phrase begins. A break is welcome here and
 *  never one word away from it. */
phraseEdges?: readonly number[];
```

The rule belongs beside the existing **pair-reach** — the block guarded by
`if (!lineIsHan && lineWords === 1)` that reaches past capacity rather than leave a
one-word line. Same shape, different trigger:

- Track the word index as segments are consumed (segments carry `words`, so the running
  total is `lineWords` plus what has already been emitted).
- **Before breaking**, check the break against rule 3. If it would be one word away from
  an edge, move it to the edge instead — backwards by preference, since pushing a whole
  phrase down is always safe — and only to a position between segments.
- Prefer a break that lands exactly on an edge when capacity allows either.

Keep it a _soft_ preference against capacity, the way the pair-reach is. A hard rule here
could loop or produce a line of one very long segment.

### Step 5 — page breaks

`src/features/post-player/lib/paginate.ts` already refuses to strand a short page
(`MIN_STANDALONE_PAGE_WORDS = 3`) and only opens a page inside a sentence at a clause break.
A page break is a break, so rules 1 and 3 apply to it:

- **Rule 3, for punctuation — done.** `paginateText(text, { keepPhraseEdges: true })` drops
  any clause break that would be one word away from a `,` `.` `;` `?` `!` `…` (counting single tokens,
  through `isBreakOneWordFromEdge`). `buildStages` passes it; community posts do not, so
  they page exactly as before. When `|` arrives, give the same filter its edges too.
- **Rule 1 — still open.** A page break must never fall inside a `_` or `=` group, but
  `paginateText` sees plain text and does not know where the groups are. Pass it the bound
  groups or their word spans.

## 5. Worked example

```
Chất_lỏng trong suốt | mà ta uống=mỗi ngày.
```

- `getWords` → `["Chất", "lỏng", "trong", "suốt", "mà", "ta", "uống", "mỗi", "ngày."]` (9)
- `boundPhrases` → `["Chất lỏng", "uống mỗi"]` → segments: `[Chất lỏng] [trong] [suốt] [mà] [ta] [uống mỗi] [ngày.]`
- `getPhraseEdges` → `[4]`

A break can only fall between segments, so the candidates are before words 2, 3, 4, 5, 6
and 8. Word 7 is not a candidate at all: it is inside `uống=mỗi` (rule 1).

| Break before | Lines it makes               | Rule 3                                                           |
| ------------ | ---------------------------- | ---------------------------------------------------------------- |
| 2            | `Chất lỏng` / `trong suốt …` | allowed — two words before the edge                              |
| 3            | `… trong` / `suốt …`         | **forbidden** — `suốt` starts the line alone                     |
| 4            | `… suốt` / `mà ta …`         | **preferred** — it is the edge                                   |
| 5            | `… mà` / `ta …`              | **forbidden** — the line ends one word past it                   |
| 6            | `… mà ta` / `uống mỗi ngày.` | allowed — two words past the edge                                |
| 8            | `… uống mỗi` / `ngày.`       | allowed by rule 3 — far from the edge; the scrap penalty decides |

(These segments were produced by the real segmenter: `trong suốt` is not in the built-in
compound list, so it is two segments here. Written as `trong_suốt`, break 3 would not exist.)

## 6. The open question on `=`

A highlight may cover a `_` and may **never** cover a `=`: `con mèo` is a classifier plus a
noun, not a phrase worth glowing.

Upstream (word-refinery) enforces this — `validateEmphasis` drops any phrase spanning a
`=`, so a well-formed deck never asks for one. But `splitWordJoiners` puts `_` and `=`
groups into the _same_ `bound` array, and `getEmphasizedWordIndexes` grows a highlight to
cover a whole bound group. **A highlight landing on one syllable of a `=` pair will
therefore expand to cover both.**

That is wrong, and it is latent rather than visible, because no current deck asks for it.
Fixing it means separating the two kinds in `splitWordJoiners` — `{ bound, clitics }`, or a
flag per group — and having `getEmphasizedWordIndexes` grow across `bound` only. Worth
doing when you touch this code; not urgent.

## 7. Non-goals

- **Do not make `|` unbreakable.** It is a preferred break, not a bond. See §3.
- **Do not resolve a phrase-edge conflict by breaking a `_` or `=` group.** The generator
  marked those as inseparable; rule 1 outranks rule 3 everywhere, pages included.
- **Do not add a character for `|`.** Unicode has no "good place to break" character, and
  the mark says nothing a reader should see. Keep it stripped and carry the indices.
- **Do not apply any of this to `usageEn`.** It carries the five-underscore answer blank
  and is auto-blanked upstream; marks are excluded from it by design.
- **Do not treat punctuation as a substitute for `|`.** The reader honours both: a `,` `.` `;` `?` `!` `…`
  is always an edge, and `|` marks the edges punctuation does not show. Neither asks the
  generator for anything new.

## 8. How to check it

**The measured layout** — `scripts/check-measured-lines.ts` (`npm run check:measured-lines`)
already asserts, for the punctuation rule:

- which words make an edge (a `,` `.` `;` `?` `!` `…` at the end of a word, inside closing quotes
  too; not inside a number, not at the end of the page, and never `:` — a Vietnamese colon
  introduces what follows and stays glued to it)
- the page in §3 breaks as `Mở cửa ra, / ồ đẹp quá!`
- a page with no edges solves exactly as before
- a break between single tokens is judged the same way (the page rule)
- across 300 random pages with commas and semicolons, a break one word from a mark is
  chosen only when no arrangement without one can be set as large (brute force over every
  arrangement)

**Pages** — `scripts/check-text-pagination.ts` asserts that with `keepPhraseEdges` a long
sentence will not open a page one word after a comma, that a break far enough from it is
kept, and that default paging is unchanged.

**Edges and pages** — extend `scripts/check-word-joiners.ts`
(`npm run check:word-joiners`):

- `getPhraseEdges` gives the indices in §5, and `countJoinedUnits` is unchanged by adding
  or removing a `|`
- a field long enough to paginate carries correctly re-based `phraseEdges` on every page
- a page break never falls inside a `_` or `=` group
- the fallback packer, at several canvas widths, never breaks one word from an edge when
  the edge is within reach, and packs a text with no edges exactly as it does today

**On screen** — the headless recipe used for the measured layout (inject marked text into
the `/api/public/vocabulary` response, read `[data-kinetic-line]` and
`[data-kinetic-segment]`) shows directly whether a rendered line boundary breaks a phrase. Run that way on the
real decks, 36 rendered pages with a `,` `.` or `;` inside (portrait and landscape) had no
break one word from one and no line over its box.
