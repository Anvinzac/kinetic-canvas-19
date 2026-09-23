/**
 * Vietnamese / English word-line layout for WordSequenceText.
 *
 * Exports: WordSequenceLines
 * Depends on: WordSequenceWord, kinetic-text vietnamese line metrics
 */

import type { ReactElement } from "react";
import type { CanvasSpec } from "@/features/canvas";
import type { getVietnameseLayoutMetrics } from "@/features/kinetic-text";
import type { ResolvedEntranceStyle } from "../lib/entrances";
import { WordSequenceWord } from "./WordSequenceWord";

type VietnameseLines = ReturnType<typeof getVietnameseLayoutMetrics>["lines"];

export type WordSequenceLinesProps = {
  isVietnamese: boolean;
  vietnameseLines: VietnameseLines;
  words: string[];
  emphasized: Set<number>;
  spotlightEmphasis: boolean;
  spec: CanvasSpec;
  staticRender: boolean;
  paused: boolean;
  isSolo: boolean;
  soloInlineScale: number;
  leftAnchoredText: boolean;
  textColor: string;
  emphasisColor: string;
  entranceStyle: ResolvedEntranceStyle;
};

/**
 * Group consecutive emphasized word indices into [start, end) ranges.
 * @param words - words argument
 * @param emphasized - emphasized argument
 * @returns Array of non-overlapping ranges covering consecutive emphasized runs
 */
function getEmphasisGroups(
  words: string[],
  emphasized: Set<number>,
  startIndex = 0,
): Array<{ start: number; end: number }> {
  const groups: Array<{ start: number; end: number }> = [];
  let i = 0;

  while (i < words.length) {
    if (!emphasized.has(startIndex + i)) {
      i += 1;
      continue;
    }

    const start = i;
    while (i < words.length && emphasized.has(startIndex + i)) {
      i += 1;
    }

    if (i - start >= 2) {
      groups.push({ start, end: i });
    }
  }

  return groups;
}

/**
 * Map words/lines to WordSequenceWord spans.
 * @param props - WordSequenceLinesProps fields
 * @returns Rendered UI
 */
export function WordSequenceLines({
  isVietnamese,
  vietnameseLines,
  words,
  emphasized,
  spotlightEmphasis,
  spec,
  staticRender,
  paused,
  isSolo,
  soloInlineScale,
  leftAnchoredText,
  textColor,
  emphasisColor,
  entranceStyle,
}: WordSequenceLinesProps): ReactElement {
  const renderWord = (
    word: string,
    index: number,
    suppressSpotlight = false,
    skipFrame = false,
  ) => (
    <WordSequenceWord
      key={`${word}-${index}`}
      word={word}
      index={index}
      words={words}
      spec={spec}
      emphasized={emphasized}
      spotlightEmphasis={spotlightEmphasis}
      suppressSpotlight={suppressSpotlight}
      staticRender={staticRender}
      paused={paused}
      isSolo={isSolo}
      soloInlineScale={soloInlineScale}
      leftAnchoredText={leftAnchoredText}
      textColor={textColor}
      emphasisColor={emphasisColor}
      entranceStyle={entranceStyle}
      skipFrame={skipFrame}
    />
  );

  if (!isVietnamese) {
    const groups = getEmphasisGroups(words, emphasized);
    const groupSet = new Set<number>();
    for (const g of groups) {
      for (let i = g.start; i < g.end; i++) groupSet.add(i);
    }

    return (
      <>
        {words.map((word, index) => {
          if (!groupSet.has(index)) return renderWord(word, index);

          const group = groups.find((g) => index >= g.start && index < g.end);
          if (!group || group.start !== index) return null;

          return (
            <span
              key={`frame-group-${index}`}
              className="kinetic-emphasis-mark kinetic-emph-frame inline-flex relative"
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
              {words
                .slice(group.start, group.end)
                .map((w, wi) => renderWord(w, group.start + wi, true, true))}
            </span>
          );
        })}
      </>
    );
  }

  return (
    <>
      {vietnameseLines.map((line, lineIndex) => (
        <div
          key={`${lineIndex}-${line.indentEm}`}
          className="flex flex-nowrap items-baseline justify-start"
          style={{
            alignSelf: "stretch",
            boxSizing: "border-box",
            columnGap: "0.24em",
            rowGap: "0.08em",
            marginTop: lineIndex === 0 ? 0 : "0.06em",
            minWidth: 0,
            paddingLeft: `${line.indentEm}em`,
            paddingRight: "2%",
            width: "100%",
          }}
        >
          {line.segments.map((segment) => {
            const flatWords = segment.words.map(({ text, index }) => ({ text, index }));
            const segGroups = getEmphasisGroups(
              flatWords.map((w) => w.text),
              emphasized,
              flatWords[0]?.index ?? 0,
            );
            const segGroupSet = new Set<number>();
            for (const g of segGroups) {
              for (let i = g.start; i < g.end; i++) segGroupSet.add(i);
            }

            return (
              <span
                key={segment.key}
                className="inline-flex flex-nowrap items-baseline whitespace-nowrap"
                style={{
                  columnGap: "0.24em",
                  flex: "0 0 auto",
                  justifyContent: "flex-start",
                }}
              >
                {flatWords.map(({ text, index }, wi) => {
                  if (!segGroupSet.has(wi)) return renderWord(text, index, true);

                  const grp = segGroups.find((g) => wi >= g.start && wi < g.end);
                  if (!grp || grp.start !== wi) return null;

                  return (
                    <span
                      key={`v-frame-group-${index}`}
                      className="kinetic-emphasis-mark kinetic-emph-frame inline-flex relative"
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
                      {flatWords
                        .slice(grp.start, grp.end)
                        .map((w, innerWi) => renderWord(w.text, w.index, true, true))}
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
