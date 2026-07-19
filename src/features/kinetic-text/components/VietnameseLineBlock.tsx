/**
 * Vietnamese staggered line block for KineticText preview layout.
 *
 * Exports: VietnameseLineBlock
 * Depends on: KineticText AnimatedWord, text-language WordLine
 */

import type { ReactElement } from "react";
import type { CanvasSpec } from "@/features/canvas";
import type { WordLine } from "../lib/text-language";
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
  spotlightEmphasis,
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
  spotlightEmphasis: boolean;
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
            const spotlightSegment =
              spotlightEmphasis && segment.words.some(({ index }) => emphasized.has(index));
            return (
              <span
                key={segment.key}
                style={{
                  alignItems: "baseline",
                  columnGap: "0.24em",
                  display: "inline-flex",
                  flexBasis: spotlightSegment ? "100%" : undefined,
                  flexWrap: "nowrap",
                  justifyContent: spotlightSegment ? "center" : undefined,
                  marginBottom: spotlightSegment ? "0.08em" : undefined,
                  marginTop: spotlightSegment ? "0.08em" : undefined,
                  whiteSpace: "nowrap",
                }}
              >
                {segment.words.map(({ text, index }) => (
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
                  />
                ))}
              </span>
            );
          })}
        </div>
      ))}
    </>
  );
}
