/**
 * Deck sentences rendered as prose. Deck text carries two authoring conventions —
 * /word/ emphasis markers and a ____ answer blank — that the kinetic stages
 * consume but that must never reach a reader as literal slashes or underscores.
 *
 * Exports: MarkedText, FilledUsage
 * Depends on: React, ../lib/stages
 */
import { Fragment } from "react";
import { splitEmphasisMarkers } from "../lib/stages";

/**
 * Render a deck sentence with its /markers/ turned into highlights.
 * @param props.text - Source field, possibly carrying /word/ markers
 * @returns Inline prose
 */
export function MarkedText({ text }: { text: string }) {
  return (
    <>
      {splitEmphasisMarkers(text).map((part, index) =>
        part.marked ? (
          <mark key={index} className="vocab-def-mark">
            {part.text}
          </mark>
        ) : (
          <Fragment key={index}>{part.text}</Fragment>
        ),
      )}
    </>
  );
}

/**
 * Render an example with its answer blank filled in and the answer picked out.
 * @param props.text - Example sentence with a ____ blank
 * @param props.word - The answer that fills it
 * @returns Inline prose
 */
export function FilledUsage({ text, word }: { text: string; word: string }) {
  const runs = text.split(/_{2,}/);
  return (
    <>
      {runs.map((run, index) => (
        <Fragment key={index}>
          <MarkedText text={run} />
          {index < runs.length - 1 && <mark className="vocab-def-answer">{word}</mark>}
        </Fragment>
      ))}
    </>
  );
}
