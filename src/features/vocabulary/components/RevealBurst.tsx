/**
 * One-shot celebration behind the revealed word: an accent flood that sweeps the
 * card, a ring, and a ring of sparks. The emoji smoke that follows is slow and
 * soft on purpose, so this is the crisp half of the payoff — it is over in under a
 * second and then gets out of the way.
 *
 * Purely decorative and CSS-driven: no timers, no state, no pointer events. Mount
 * it with a fresh `key` to replay it.
 *
 * Exports: RevealBurst
 * Depends on: React (CSS in ../vocabulary.css)
 */

import type { CSSProperties } from "react";

const SPARK_COUNT = 14;

/** Deterministic spark fan: even angles, alternating reach so it never reads as a perfect circle. */
const SPARKS = Array.from({ length: SPARK_COUNT }, (_, index) => ({
  angle: (360 / SPARK_COUNT) * index + (index % 2 ? 9 : -6),
  reach: index % 3 === 0 ? 1 : index % 3 === 1 ? 0.78 : 0.6,
  delay: (index % 4) * 0.018,
}));

/**
 * Render the reveal flood, ring and sparks, centred on the answer.
 * @returns Decorative overlay; it animates once on mount
 */
export function RevealBurst() {
  return (
    <div className="vocab-reveal-burst" aria-hidden="true">
      <span className="vocab-reveal-flash" />
      <span className="vocab-reveal-ring" />
      {SPARKS.map((spark, index) => (
        <i
          key={index}
          className="vocab-reveal-spark"
          data-tint={index % 3}
          style={
            {
              "--spark-angle": `${spark.angle}deg`,
              "--spark-reach": spark.reach,
              "--spark-delay": `${spark.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
