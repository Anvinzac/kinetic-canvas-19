# HANDOFF: two fixes worth porting to the Japanese-leading sibling

**For:** whoever works on the sibling repo (Japanese as the leading language).
**From:** the Vietnamese/English repo, where both of these were found and fixed.

Two defects were solved here that the sibling still has:

1. **The scene flashes between one word finishing and the next beginning.**
2. **The shadow/glow around emphasised text is cropped to a hard box.**

Both are in shared machinery — the card's backdrop, and the kinetic-text emphasis layer —
so the fixes should port almost verbatim. **§4 lists what NOT to bring across**, because
some of what sits next to these fixes is specific to this repo's language.

Each section ends with **"Done when"** — the observable test, not "the code looks like the
diff". Both of these were mis-diagnosed at least once here and the wrong fix looked
plausible, so check the symptom, not the patch.

---

## 1. The flash between words

### What it looks like

Swiping or auto-advancing from one word to the next, the incoming card's background
visibly snaps — colours jump, and in landscape it reads as two colours side by side
resolving into one. It happens at the moment the next card becomes the current one, while
it is already partly on screen.

### Why

The card's sliding colour strip was sized and offset **only once the card was playing**.
A neighbour waiting off-screen was painted from a differently sized, differently placed
strip, and snapped to its real geometry the instant it became current — mid-swipe, in
view.

So the flash is not a transition that needs smoothing. It is two different geometries for
the same element, and the fix is to stop having two.

### The fix

Commit **`eb6ae63`** — *"fix(vocab): one backdrop geometry per card; pause/resume fade
without opacity"*.

- **`src/features/vocabulary/vocabulary.css`** — `.vocab-backdrop-drift[data-strip]`
  carries the inset and the resting offset for **every** card with a strip, playing or
  not. `[data-drift]` only adds the animation. The resting offset is written as the
  keyframes' own first frame (`translate(-7%, 0)`), so becoming current starts the motion
  from where the card already is instead of moving it there.
- **`[data-drift="held"]`** → `animation-play-state: paused`. Leaving a word **freezes**
  its drift rather than resetting it, so the outgoing card does not jump while sliding
  away, and it resumes from the same place if the reader swipes back.
- **`src/features/vocabulary/components/VocabularyCard.tsx`** — the `drifted` latch (around
  line 464): once a card has drifted it never returns to its untouched form while mounted.
  Dropping the attribute instead put the element back to its first-paint geometry, which is
  the same flash a frame later.

A second, related flash is fixed in the same commit and is worth taking: **the pause pop
and the resume button no longer animate their own `opacity`**. An element below full
opacity cannot sample what is behind it, so a backdrop blur paints as a hard unblurred
square until the fade finishes. They fade by growing tint, blur radius and shadow from
zero, with only the icon's opacity moving.

### Done when

Advance between two words with **visibly different palettes**, slowly — drag the swipe
rather than letting it animate, or step frames in a recording.

- The incoming card's background must be the same at 10% on screen as at 100%. Nothing
  about it changes at the moment it becomes current.
- The outgoing card must not jump as it leaves.
- Swipe back: the card you return to resumes its drift from where it was, not from the
  start.
- Pause and resume: the button's blur is soft from the first frame of its fade, never a
  hard square that goes soft at the end.

---

## 2. The box-shaped crop around glowing text

This one is **two independent causes with the same symptom**, fixed in two commits. The
sibling may have either or both. Check for both — fixing one leaves the other looking like
a partial fix.

### Cause A: a `filter` on the same element clips its own text-shadow

Commit **`4484427`** — *"fix(text): stop the glow pulse cropping the glow"*.

The `glow` emphasis variant painted its light as a `text-shadow` and breathed with
`filter: drop-shadow()` **on the same element**. A filter clips that element's rendering to
the filter region — the border box plus the filter's own spread — and the spread (0.08em)
was far smaller than the shadow's reach (0.4em plus a 30px drop). The halo stopped dead on
straight horizontal and vertical edges.

**The distinction that matters, because getting it wrong cost a session here:** a filter on
a **parent** does *not* clip a child's shadow. Same element is the case that clips. If you
test this, put the filter and the shadow on the same element or you will prove the wrong
thing.

**The fix:** animate the glow's **own radii** instead of filtering it.

- **`src/styles.css`** — `@property --kinetic-glow-inner` and `--kinetic-glow-outer`,
  `syntax: "<number>"`, driven by `@keyframes kinetic-emphasis-glow`.
  They are `<number>` and not `<length>` because **a registered property's initial value
  must be computationally independent** — an `em` there is invalid and the registration is
  silently dropped. The `em` is applied at the point of use:
  `calc(var(--kinetic-glow-inner, 0.14) * 1em)`.
- **`src/features/kinetic-text/lib/emphasis.ts`** — `getEmphasisTextShadow` stays the one
  place the shadow's **shape** is written; only those two numbers move.
- The `var()` fallbacks are the resting glow, so a browser without `@property` paints the
  glow without the breath rather than losing it.

### Cause B: a transform scales the shadow with the element

Commit **`dc9370e`** — *"fix(text): draw the emphasis underline by width, not by scaling
it"*.

The glow under a highlighted word arrived as a hard-edged rectangle, vanished, then went
soft. A `box-shadow` is part of an element's rendering, so a transform takes the shadow
with it: at `scaleX(0.3)` a 0.24em glow is squashed to a third of its blur horizontally
while staying full height — which is exactly what a box looks like. It appeared to "fix
itself" as the draw completed because the glow was being stretched back out.

**The fix:** grow the **width**, not the scale.

- **`src/styles.css`** — `--kinetic-underline-width` carries the resting width so the
  keyframes animate to it without restating the geometry; the joined variant overrides only
  that value and inherits the same draw. The cost is laying out one absolutely positioned
  pseudo-element, which affects nothing around it.
- The joined stroke never scaled — it only faded — so its keyframes were carrying a
  `scaleX(1)` that did nothing. It went with the rest.

### A third, smaller one in the same family

**`src/features/post-player/lib/entrances.ts`** — `getEntranceRest(hidden)` adds
`filter: "blur(0px)"` to a resting state **only when the hidden state had a filter**.
Previously every entrance rested with a no-op filter, which is ~20 pointless filters per
card of compositing work. Guarded by `scripts/check-entrance-rest.ts`.

Note this did **not** fix the crop — I claimed it did, and was wrong. Take it for its own
reason (wasted compositing), not as a cure for the symptom.

### Done when

Freeze frames through a highlighted word's entrance — not just at rest, because both
causes are transient and look fine once settled.

- At **~60ms** into the underline draw, the glow under the word is soft on all sides. A
  rectangle there is Cause B.
- At the **trough and the peak** of the glow pulse, the halo's falloff is soft all round,
  and the element computes `filter: none`. A halo with straight vertical edges is Cause A.
- The peak is still visibly wider than the trough — if the pulse stopped working, the
  `@property` registration was dropped (most likely an `em` in `initial-value`).
- Geometry unchanged: the lone underline measures `100% + 0.04em`, the joined one
  `100% + 0.28em`. That bleed is what keeps a compound word's stroke continuous.

### Known not fixed here

`fringe` and `flash` run filters on the element carrying the default text-shadow, so they
share Cause A. It shows far less — their shadow is fainter and their filters are one-shot
— but it is the same mechanism. Undoing it means rebuilding what those two effects are.

---

## 3. Guards worth porting with the fixes

Pure-logic checks, no DOM, so they run anywhere:

| Script | Covers |
| --- | --- |
| `scripts/check-text-emphasis.ts` | the emphasis variants and their styling |
| `scripts/check-emphasis-runs.ts` | which runs get emphasised |
| `scripts/check-entrance-rest.ts` | a resting state carries `filter` only when it must |

They are wired as `npm run check:*`. Port the ones whose subject you are porting; a fix
without its guard comes back.

---

## 4. What NOT to bring across

The sibling leads in Japanese. Several things sitting beside these fixes in this repo are
**language-specific and will do damage if copied wholesale**:

- **Anything keyed to Vietnamese text layout.** `useMeasuredLines`,
  `solveMeasuredLines`, the phrase-break rules and the line-count floors
  (`TWO_LINE_MAX_SYLLABLES`, `LONG_PAGE_SYLLABLES`) are built on Vietnamese being written
  one syllable at a time. Japanese line breaking is a different problem with different
  rules. Neither fix in this document depends on any of it.
- **The word-joiner convention.** `_` joining a word's syllables (`ba_lô`) and
  `src/features/vocabulary/lib/word-joiner.ts` are a Vietnamese answer to a Vietnamese
  problem. Not relevant.
- **`EMPHASIS_FONT_SCALE` and the glyph-stroke variants.** There is a deliberate guard here
  (`isGlyphStrokeSafeText`) that keeps the outline effect **away from Vietnamese**, because
  a Vietnamese glyph plus its diacritics is not one unified vector shape and an outline
  around it looks broken. **For Japanese that reasoning inverts** — the effect was judged
  suitable for Han-like characters, which is most of what the sibling renders. Do not copy
  this repo's exclusion; decide it there.
- **Locale lists.** Several scripts here hardcode `en,zh,ko,ja`. They are this repo's deck
  inventory, not a contract.
- **The whole `scripts/render-export-clip.ts` / `/showcase` surface.** Unrelated to either
  fix, and it carries frame geometry tuned for this repo's chrome.

**The safe boundary:** both fixes live in `vocabulary.css`, `styles.css`,
`emphasis.ts`, `entrances.ts` and `VocabularyCard.tsx`'s drift latch. None of them reads
the text's language. If a port starts pulling in a file that decides where lines break,
it has gone too far.

---

## 5. Commits to read, in order

```
eb6ae63  one backdrop geometry per card; pause/resume fade without opacity   ← §1
dc9370e  draw the emphasis underline by width, not by scaling it             ← §2, Cause B
4484427  stop the glow pulse cropping the glow                               ← §2, Cause A
```

Read the messages, not only the diffs. `dc9370e` and `4484427` each correct a wrong
diagnosis stated in the commit before them, and the corrections are the useful part: the
first wrong answer was "a leftover `filter: blur(0px)` is clipping it", which is wrong, and
the second was "a filter never clips a shadow", which is right only when the filter is on a
parent. If the sibling's symptom does not match what you expect after porting, that history
is where to look before writing a new theory.
