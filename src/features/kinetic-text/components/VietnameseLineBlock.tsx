/**
 * Group consecutive emphasized word indices within a segment into [start, end) ranges.
 * @param words - words argument
 * @param emphasized - emphasized argument
 * @returns Array of non-overlapping ranges covering consecutive emphasized runs of 2+ words
 */
function getEmphasisGroups(
  words: Array<{ text: string; index: number }>,
  emphasized: Set<number>,
): Array<{ start: number; end: number }> {
  const groups: Array<{ start: number; end: number }> = [];
  // A glyph-less token (punctuation, a masked "_____" blank) can carry an index in
  // `emphasized`, but framing it draws an empty box around nothing. Break runs on such
  // tokens so they neither start, extend, nor sit inside a shared frame (mirrors feed).
  const hasGlyph = (text: string) => /\p{L}|\p{N}/u.test(text);
  let i = 0;

  while (i < words.length) {
    if (!emphasized.has(words[i].index) || !hasGlyph(words[i].text)) {
      i += 1;
      continue;
    }

    const start = i;
    while (i < words.length && emphasized.has(words[i].index) && hasGlyph(words[i].text)) {
      i += 1;
    }

    if (i - start >= 2) {
      groups.push({ start, end: i });
    }
  }

  return groups;
}

/**
 * Vietnamese staggered line block for KineticText preview layout.
 *
 * Exports: VietnameseLineBlock
 * Depends on: KineticText AnimatedWord, text-language WordLine
 */

import type { ReactElement } from "react";
import type { CanvasSpec } from "@/features/canvas";
import type { WordLine } from "../lib/text-language";
import { getRunEmphasisStyle } from "../lib/emphasis";
import { AnimatedWord } from "./WordRenderer";
import { entranceVariants } from "./preview-tempo";

type WordVariants = ReturnType<typeof entranceVariants>;

/**
 * Render the VietnameseLineBlock UI.
 * @param props - Component props
 * @returns Rendered UI
 */
export function VietnameseLineBlock({
  lines,
  playKey,
  wordVariants,
  spec,
  tempo,
  paused,
  emphasized,
  textColor,
  emphasisColor,
  staticLayout,
  words,
  phraseKeys,
}: {
  lines: WordLine[];
  playKey: number;
  wordVariants: WordVariants;
  spec: CanvasSpec;
  tempo: { duration: number };
  paused: boolean;
  emphasized: Set<number>;
  textColor: string;
  emphasisColor: string;
  staticLayout: boolean;
  words: string[];
  /** Bound phrase keys — the curated list plus every highlighted run — for shared styling. */
  phraseKeys?: readonly (readonly string[])[];
}): ReactElement {
  return (
    <>
      {lines.map((line, lineIndex) => (
        <div
          key={`${lineIndex}-${line.indentEm}`}
          style={{
            alignSelf: "stretch",
            boxSizing: "border-box",
            display: "flex",
            flexWrap: "nowrap",
            justifyContent: "flex-start",
            columnGap: "0.24em",
            rowGap: "0.1em",
            marginTop: lineIndex === 0 ? 0 : "0.08em",
            minWidth: 0,
            paddingLeft: `${line.indentEm}em`,
            paddingRight: "2%",
            width: "100%",
          }}
        >
          {line.segments.map((segment) => {
            const segGroups = getEmphasisGroups(segment.words, emphasized);
            const segGroupSet = new Set<number>();
            for (const g of segGroups) {
              for (let i = g.start; i < g.end; i++) segGroupSet.add(i);
            }
            return (
              <span
                key={segment.key}
                style={{
                  alignItems: "baseline",
                  columnGap: "0.24em",
                  display: "inline-flex",
                  flex: "0 0 auto",
                  flexWrap: "nowrap",
                  justifyContent: "flex-start",
                  whiteSpace: "nowrap",
                }}
              >
                {segment.words.map(({ text, index }, wi) => {
                  if (!segGroupSet.has(wi))
                    return (
                      <AnimatedWord
                        key={`${playKey}-${text}-${index}`}
                        word={text}
                        index={index}
                        playKey={playKey}
                        wordVariants={wordVariants}
                        spec={spec}
                        tempo={tempo}
                        paused={paused}
                        anchorFromStart
                        spotlightWord={false}
                        important={emphasized.has(index)}
                        textColor={textColor}
                        emphasisColor={emphasisColor}
                        staticLayout={staticLayout}
                        words={words}
                        phraseKeys={phraseKeys}
                      />
                    );

                  const grp = segGroups.find((g) => wi >= g.start && wi < g.end);
                  if (!grp || grp.start !== wi) return null;

                  // One effect for the whole group, hashed from the group itself: seeding per
                  // syllable lets a compound the phrase list never heard of split in two.
                  const sharedVariant = getRunEmphasisStyle(
                    spec.text,
                    words,
                    segment.words.slice(grp.start, grp.end).map((w) => w.index),
                    emphasisColor,
                  );
                  return (
                    <span
                      key={`v-frame-group-${index}`}
                      className="inline-flex relative"
                      style={{
                        display: "inline-flex",
                        flex: "0 0 auto",
                        alignItems: "baseline",
                        columnGap: "0.24em",
                        padding: "0.05em 0.3em 0.1em",
                        borderRadius: "0.28em",
                        border: "0.05em solid transparent",
                        isolation: "isolate",
                      }}
                    >
                      {segment.words.slice(grp.start, grp.end).map((w, innerWi) => (
                        <AnimatedWord
                          key={`${playKey}-${w.text}-${w.index}`}
                          word={w.text}
                          index={w.index}
                          playKey={playKey}
                          wordVariants={wordVariants}
                          spec={spec}
                          tempo={tempo}
                          paused={paused}
                          anchorFromStart
                          spotlightWord={false}
                          important={emphasized.has(w.index)}
                          skipFrame
                          textColor={textColor}
                          emphasisColor={emphasisColor}
                          staticLayout={staticLayout}
                          words={words}
                          phraseKeys={phraseKeys}
                          sharedVariant={sharedVariant}
                        />
                      ))}
                    </span>
                  );
                })}
              </span>
            );
          })}
        </div>
      ))}
    </>
  );
}
