# Staff Review: Frame Grouping & Vietnamese Phrase Changes

## Hidden Invariants Broken

### [CRITICAL] `getEmphasisGroups` index mismatch in WordSequenceLines Vietnamese path
**src/features/post-player/components/WordSequenceLines.tsx:171**

The local `getEmphasisGroups(words: string[], emphasized: Set<number>)` checks `emphasized.has(i)` where `i` is the **array position** (0, 1, 2…) within the segment. But `emphasized` contains **absolute page-wide word indices**. The call `getEmphasisGroups(flatWords.map((w) => w.text), emphasized)` strips the `.index` property, leaving only relative positions. Unless a segment starts at word index 0, `emphasized.has(0)` through `emphasized.has(n-1)` will be false. Frame grouping silently never activates for Vietnamese text in the post-player.

The correct version exists in `VietnameseLineBlock.tsx:15` where `getEmphasisGroups` takes `Array<{ text, index }>` and checks `emphasized.has(words[i].index)`.

### [CRITICAL] Frame wrapper missing `is-animated` class
**src/features/kinetic-text/components/KineticText.tsx:192, WordSequenceLines.tsx:131/201, VietnameseLineBlock.tsx:151**

CSS animation lives at `.kinetic-emph-frame.is-animated::after` (styles.css:260). Wrapper spans have `kinetic-emph-frame` but omit `is-animated`. Inner words get `is-animated` but have `skipFrame=true` which strips `kinetic-emph-frame`. No element matches both selectors — the frame border appears instantly with zero draw animation.

### [CRITICAL] Missing `--kinetic-emphasis-delay` on wrapper
**All wrapper locations**

`emphasisStyle` (containing `--kinetic-emphasis-delay`) is applied to the innermost span. CSS custom properties cascade downward only. The wrapper's `::after` cannot read a delay from children. Even if `is-animated` were added, the frame draw would use the hardcoded `0.68s` fallback (styles.css:262) instead of the per-word computed delay.

### [HIGH] Frame grouping is variant-agnostic
**WordSequenceLines.tsx:57, KineticText.tsx:46**

`getEmphasisGroups` groups any consecutive emphasized words regardless of emphasis variant. The wrapper always gets `kinetic-emph-frame`. But `getEmphasisVariant` (emphasis.ts:53) hashes per-word, so consecutive emphasized words typically get different variants (halo, underline, sweep). A `halo`-emphasized word ends up boxed inside a static `frame` border wrapper.

### [HIGH] Removing "khoảng thở" changes emphasis seed
**vietnamese-phrases.ts:26-28,82-84**

`getBoundPhraseEmphasisSeed` now returns `"khoảng"` or `"thở"` instead of `"khoảng thở"`. Since `getEmphasisVariant` hashes the seed (emphasis.ts:53), the emphasis variant for these words changes — altering visual design of existing posts (e.g., demo seed at feed-a.ts:69). `getBoundPhraseStartIndex` also changes, altering `entranceDelay` timing.

## Downstream Paths (Ripple Effects)

- `expandEmphasisToBoundPhrases` (vietnamese-phrases.ts:134) → no longer expands "khoảng thở" as a pair; if only "khoảng" is scored, "thở" won't be auto-selected
- `getSpecialPoeticWordIndexes` (vietnamese-phrases.ts:103) → "khoảng thở" removed from poetic emphasis triggers
- `isLikelyVietnameseText` (index.ts:55) → slightly weakened detection, but other phrases remain
- `WordSequenceWord` (WordSequenceWord.tsx:45/69) → `skipFrame` prop added; removes frame class and margins for grouped frame-variant words
- `AnimatedWord` (WordRenderer.tsx:58) → same `skipFrame` prop
- `getEmphasisInnerAnimation` (emphasis.ts:100) → returns `undefined` for "frame"; relies entirely on CSS `::after` which is already broken
- CSS `::after` (styles.css:250-258) → border/glow/clip-path requires both `kinetic-emph-frame` AND `is-animated`; neither met on any wrapper or grouped word

## Tech Debt Introduced

1. **`getEmphasisGroups` triplicated** — Three copies in KineticText.tsx (string-based), VietnameseLineBlock.tsx (object-based, correct), WordSequenceLines.tsx (string-based, buggy). Signature divergence caused the CRITICAL bug. Should be a shared utility.
2. **Redundant inline styles** — Wrapper spans set `padding`, `borderRadius`, `border`, `isolation` inline — duplicating `.kinetic-emph-frame` CSS (styles.css:243-248).
3. **Inconsistent wrapper margins** — KineticText.tsx:198-199 adds `marginLeft: "-0.02em"` / `marginRight: "-0.02em"`; equivalent wrappers in VietnameseLineBlock.tsx and WordSequenceLines.tsx do not.
4. **IIFE in JSX** — KineticText.tsx:157 uses `(() => { ... })()`, creating a new closure on every render.
5. **No test coverage** — Zero `.test.ts`/`.spec.ts` files in `src/`. Frame grouping, `skipFrame`, variant selection entirely untested.
6. **Misleading variable naming** — `segGroupSet` and `wi` hold relative segment positions but are named as if absolute. This enabled the CRITICAL index-mismatch bug.

## Simulation: Real-Life Failures

**High load / animation loop:** KineticText re-renders on every `playKey` tick. IIFE + `getEmphasisGroups` + `groupSet` Set construction + `groups.find()` (O(n) per word) runs each frame. For 10 words all emphasized: O(n²) = 100 ops per render at 60fps = GC churn.

**Retry / Strict Mode:** React 18 double-invokes render. IIFE and `getEmphasisGroups` run twice per cycle — no correctness issue, doubled CPU.

**Race condition:** Not possible in single-render synchronous flow. Theoretical Tearing risk if parent mutates `emphasized` Set between frames in concurrent render.

**Missing index (killer scenario):** 10-word Vietnamese post, emphasis on absolute indices 5–6. Segment starts at relative position 0. `getEmphasisGroups` checks `emphasized.has(0)`, `emphasized.has(1)` — both false (Set contains {5, 6}). Returns `[]`. No frame wrapper emitted. Feature never fires for any Vietnamese segment past word 0. Works only by pure coincidence.
