# HANDOFF: the recorded feed's layout, and why the inset keeps fighting back

**For:** whoever picks up the promo-clip recording after me.
**Companion to:** `scripts/render-export-clip.ts` (makes the clip),
`scripts/post-to-tiktok.ts` (hands it to the app).

**Status in one line:** clips render at a genuine 1080×1920 and the title is anchored to
the export preset's safe corner, but the scene has **three different horizontal margins**
instead of one, so every request to "make the inset smaller" cuts a different element
first, and five rounds of tuning have not converged. §6 is the fix I would make.

**Read §2 first.** The whole design rests on one unverified assumption.

---

## 1. What the job is

Record one word from the live `/feed` as a 9:16 MP4 that can be posted to TikTok, with the
app's own interface visible — a visitor's view, not a cutout of the card.

```bash
npx tsx scripts/render-export-clip.ts --out ~/clip.mp4
npx tsx scripts/post-to-tiktok.ts ~/clip.mp4     # needs the emulator; see that file
```

Recording is real time: a 45-second word takes 45 seconds.

---

## 2. The assumption everything rests on — UNVERIFIED

The layout work exists to survive this:

> A 9:16 clip on a phone taller than 9:16 is scaled to **cover** the feed, so the left and
> right edges are cropped away. At 20:9 that is 12.5% of the width from each edge.

**I never confirmed this against real TikTok.** It was inferred from one line of user
feedback — "the left and right padding is not maintained" — and every inset number since
has been fitted to a *simulation* of that crop, not to the platform. I have never seen the
app's actual output. The person I was working with has.

If the real behaviour is different — letterboxing, a different scale factor, an overlay
rather than a crop, or cropping only in some placements — then the insets are protecting
against the wrong thing, and that would explain why each reduction still "breaks it".

**Do this before tuning anything:** post one clip with `--side 0 --inset 0,0`, screenshot it
on a real phone in the real app, and measure what is actually lost. Ten minutes of that
replaces all the arithmetic below. Everything in §4 is downstream of this and should be
re-derived if it turns out to be wrong.

---

## 3. How the recording differs from a reader's view

The recorder injects a stylesheet and a class; **every rule is scoped so a reader sees
nothing of this.** Variables are read with a `0px` fallback and declared nowhere, so when
they are absent the layout is byte-for-byte what it always was (verified by measurement, not
assumed).

| Channel | Set by | Read by |
| --- | --- | --- |
| `--vocab-chrome-head` | `--inset <top>,<bottom>` | toolbar top (reader path) |
| `--vocab-chrome-inset` | `--inset <top>,<bottom>` | bottom chrome stack |
| `--vocab-chrome-side` | `--side <px>` | text band, progress row, button row, saved dock |
| `--vocab-safe-top` / `--vocab-safe-right` | the **export preset's** `safe` fractions | recorded toolbar corner |
| `.vocab-recording` | always, while recording | everything in `vocabulary.css` §"Recorded…" |
| `.vocab-hide-controls` | `--controls hide` | hides the transport controls |

Rules live in `src/features/vocabulary/vocabulary.css` around lines 420–500. The recorder
sets **flags and numbers only** — never selectors — so renaming an element cannot leave a
dead selector in the script, where it would fail silently.

---

## 4. The actual problem: three margins, not one

This is why "reduce the inset" keeps breaking something. At `--side S`, on a 405px-wide
viewport, each thing ends up at a different distance from the edge:

| Element | Margin | At `S=12` |
| --- | --- | --- |
| Title (top-right) | `--vocab-safe-right`, from the preset | **61px** |
| Gear (top-left) | `16 + S + 20` | 48px |
| Body text | `16 + S` | 28px |
| Progress + button rows | `24 + S` | 36px |
| Saved-words dock | hidden while recording | — |

The crop, for comparison: **44px** at 19.5:9, **51px** at 20:9, **63px** at 21:9.

So `S` does not mean "the margin". It is an *offset added to four different base values*,
and lowering it walks each element past the crop line at a different moment. Measured on
the current render at `S=12`:

| | title | body text | button row |
| --- | --- | --- | --- |
| uncropped | 61px | 45px | 36px |
| 19.5:9 | 30px | 11px | **cut** |
| 20:9 | 26px | 7px | **cut** |
| 21:9 | 17px | **cut** | **cut** |

The title holds because it stopped depending on `S` (commit `c55d68c`). The button row goes
first because its base (24px) makes it the deepest-inset thing, so proportionally it loses
the most when `S` shrinks — the opposite of what you would guess.

**History of the tuning, so nobody repeats it:** 52 → 31 → 25 → 12, each step a request to
make the frame less boxed-in. 52 cleared the crop outright. Nothing below ~45 protects the
rows. There is no value of `S` that is both visually open and crop-safe, because `S` is the
wrong knob.

---

## 5. Pitfalls that each cost real time

Every one of these failed **silently** — the clip rendered, it was just wrong.

1. **`Page.startScreencast` returns CSS-pixel frames.** It ignores an emulated device scale
   factor, so clips were captured at 405×720 and upscaled to 1080×1920. Fixed with
   `--force-device-scale-factor` at the browser. The recorder now **refuses** to encode when
   the captured frame is smaller than the output size — a warning was not enough.
2. **`document.documentElement` is null at document-start.** `addScriptToEvaluateOnNewDocument`
   runs before the parser builds `<html>`, so `classList.add` threw and skipped the flag —
   while the stylesheet, already deferred to `DOMContentLoaded`, went in anyway. That one
   throw is why the insets worked and the hidden chrome did not. Everything is deferred now.
3. **Hydration resets `<html>`'s className.** `RootShell` renders `<html lang="en">` with no
   class, so React clears anything added before hydration. The flag is re-applied by a
   `MutationObserver`.
4. **An own-element declaration beats an inherited value.** Setting a variable on `:root`
   does nothing if the element declares it itself. This cost two separate sessions
   (`--vocab-corner`, `--vocab-chrome-inset`). `check-chrome-side` now fails if
   `--vocab-chrome-side` is declared anywhere at all.
5. **A one-word page floors at `0.74`** (`getPreviewFitFloor`), so the answer word could not
   shrink to fit a narrowed band and was simply drawn outside it. `clampFitScale` makes the
   box win over the legibility floor.
6. **The browser pane is not the recorder.** A dock-hiding fix passed in the pane and still
   failed in the render, because the pane could not reproduce the document-start timing.
   **Verify in an actual recorder run**, via the probe recipe in §7.

---

## 6. What I would do instead of tuning `S` further

Give the scene **one** margin, so "tighter" moves everything together and nothing is cut
before anything else.

1. Define `--vocab-scene-margin` once, while recording.
2. Have the title, gear, text band, progress row and button row all sit at exactly that
   value — delete the per-element 16/24/20 bases from the recorded path. They are reader
   geometry and have no business setting the recorded frame's edge.
3. Derive its default from the measurement asked for in §2, not from the simulation.
4. Extend `check-chrome-side` to assert every recorded element resolves to the *same*
   margin — an assertion on the result, which is the only kind that has held up here.

Then "reduce the inset by half" has one meaning, moves one number, and either everything
survives a crop or nothing does — which is a thing you can see in one frame rather than
discover per element.

---

## 7. How to verify anything here

**Simulate a crop** (this is the 20:9 case; the three cases are in the table in §4):

```bash
ffmpeg -v error -y -ss 20 -i clip.mp4 -frames:v 1 \
  -vf "scale=1350:2400,crop=1080:2400:135:0,scale=405:-1" crop209.png
```

**Measure ink rather than boxes.** Glyph ink sits further in than its element's box, so the
arithmetic is pessimistic and has been wrong about what survives more than once. Threshold
the frame against the row's median brightness and take the first and last differing column.
`PIL` is available.

**Probe a real recorder run.** Temporarily insert a `cdp.evaluate` after the
`"the feed never put a word on screen"` guard in `render-export-clip.ts`, print it, and
`throw` to stop before encoding. This is the only way to see the hydrated, flagged page as
the recorder sees it.

**Guards** — `npm run check:chrome-side` (11), `npm run check:fit-floor` (8). Both have been
negative-tested by breaking the source on purpose. Do that again if you change them; a green
check that cannot go red is worth nothing.

---

## 8. Other open ends

- **Audio is silent.** The screencast is video-only; the AAC track exists so the upload is
  ordinary for a platform's ingest, and carries nothing.
- **Clips are named by position**, not by headword. Reading the word off the page during the
  take was tried and dropped rather than shipping a silent fallback.
- **The TikTok emulator path is unproven past install.** A stock AVD cannot pass Play
  Integrity, so login or upload may be refused; `post-to-tiktok.ts` is verified only as far
  as push and MediaStore indexing. A real Android phone over USB uses the identical script
  with no attestation problem.
- **`check-vietnamese-line-fit` fails** on an underline join rule. It fails at `a296a5c`
  too — it predates all of this and is unrelated.
- **The 4-line rule for long pages is a preference, not a floor** — it only displaces a
  3-line layout when the 4-line one sets *larger* type. Its threshold is also `> 9`, so it
  fires at 10+ syllables despite the name. Both are in
  `src/features/kinetic-text/lib/text-language/measured-lines.ts`.

---

## 9. Commits, if you want to rewind

```
39e7248  side inset 25 -> 12            ← current; rows are cut at every crop
c55d68c  title anchored to preset safe corner   ← keep this, it is the one solid piece
3c1d51e  title moved to top-right
2fb325c  side inset 31 -> 25
cc92d30  answer word fitted; reader-only chrome hidden
d09cab1  side inset 52 -> 31
dc42612  --vocab-chrome-side introduced
1d5af7e  capture at device pixels, not upscaled  ← independent, keep
```

`git revert 39e7248` returns to `S=25`, where the button row survived. Reverting past
`dc42612` removes the side inset entirely, which is the right baseline if §2 shows the crop
is not real.
