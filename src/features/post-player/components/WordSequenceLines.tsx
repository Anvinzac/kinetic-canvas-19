/**
 * Vietnamese / English word-line layout for WordSequenceText.
 *
 * Exports: WordSequenceLines
 * Depends on: WordSequenceWord, kinetic-text vietnamese line metrics
 */

import type { ReactElement } from "react";
import type { CanvasSpec } from "@/lib/canvas";
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
 * @responsibility Map words/lines to WordSequenceWord spans.
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
  const renderWord = (word: string, index: number, suppressSpotlight = false) => (
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
    />
  );

  if (!isVietnamese) {
    return <>{words.map((word, index) => renderWord(word, index))}</>;
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
            const spotlightSegment =
              spotlightEmphasis && segment.words.some(({ index }) => emphasized.has(index));
            return (
              <span
                key={segment.key}
                className="inline-flex flex-nowrap items-baseline whitespace-nowrap"
                style={{
                  columnGap: "0.24em",
                  flexBasis: spotlightSegment ? "100%" : undefined,
                  justifyContent: spotlightSegment ? "center" : undefined,
                  marginBottom: spotlightSegment ? "0.08em" : undefined,
                  marginTop: spotlightSegment ? "0.08em" : undefined,
                }}
              >
                {segment.words.map(({ text, index }) => renderWord(text, index, true))}
              </span>
            );
          })}
        </div>
      ))}
    </>
  );
}
