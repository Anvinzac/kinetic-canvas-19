/**
 * First-load level picker: the difficulty ladder as one draggable gauge.
 *
 * A new reader has no way to know what "đọc hiểu" or "chuyên sâu" will feel like, and the
 * toolbar's dropdown only names them. So before the first word, the whole screen is the
 * ladder: every level down the left, a rail with a knob through the middle, and — on the
 * other side of the rail — one real word from the level's own top band, so each name is
 * anchored to something concrete. The knob takes a hotter colour at every rung, so the
 * climb in intensity is visible before a single label is read.
 *
 * Exports: DifficultyOnboarding
 * Depends on: difficulty tracks, feed metadata types, vocabulary.css
 */

import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import {
  DIFFICULTY_ALL,
  DIFFICULTY_TRACKS,
  countTrackWords,
  formatLevelBand,
  isTrackAvailable,
  trackCeiling,
} from "../lib/difficulty";
import type { FeedPage } from "../types";

/**
 * One colour per rung, easiest to hardest: cool mint through lime and amber to red, then
 * on into magenta and violet. Ten distinct steps, so no two neighbouring levels share a hue.
 */
const RUNG_COLORS = [
  "#5eead4",
  "#6ee7a0",
  "#a3e635",
  "#fde047",
  "#fbbf24",
  "#fb923c",
  "#f97316",
  "#ef4444",
  "#ec4899",
  "#a855f7",
] as const;

/**
 * Nearest rung that can be chosen, searching outwards from a target.
 * @param target Rung the pointer or key asked for
 * @param available Per-rung availability
 * @returns The closest available rung, or -1 when none is
 * @pure true
 */
function nearestAvailable(target: number, available: readonly boolean[]): number {
  for (let distance = 0; distance < available.length; distance += 1) {
    if (available[target - distance]) return target - distance;
    if (available[target + distance]) return target + distance;
  }
  return -1;
}

/**
 * Full-screen level picker shown before the very first word.
 * @param props.metadata Counts, populated levels and sample words; undefined while loading
 * @param props.onPick Called with the chosen track id, or "" for every level
 * @returns The picker
 */
export function DifficultyOnboarding({
  metadata,
  onPick,
}: {
  metadata: Pick<FeedPage, "levelCounts" | "levels" | "levelSamples"> | undefined;
  onPick: (difficulty: string) => void;
}) {
  // Several tracks top out at the same level; each takes the NEXT sample of that level so
  // no two rungs are illustrated by the same word.
  const taken = new Map<string, number>();
  const rungs = DIFFICULTY_TRACKS.map((track, index) => {
    const available = metadata ? isTrackAvailable(track, metadata.levels) : false;
    // Honour sampleLevel override so vỡ lòng can show an A1 word instead of the
    // A2 business term that happens to be first in the base catalog for that level.
    const ceiling = track.sampleLevel ?? trackCeiling(track);
    const pool = (available && metadata?.levelSamples[ceiling]) || [];
    const turn = taken.get(ceiling) ?? 0;
    if (pool.length) taken.set(ceiling, turn + 1);
    return {
      track,
      color: RUNG_COLORS[index % RUNG_COLORS.length]!,
      band: formatLevelBand(track.levels),
      available,
      count: metadata ? countTrackWords([track.id], metadata.levelCounts, metadata.levels) : null,
      // The word comes from the track's hardest level: that is the level that sets it apart
      // from the rung below, so it is the honest picture of what choosing it adds.
      sample: pool.length ? pool[turn % pool.length] : undefined,
    };
  });
  const availability = rungs.map((rung) => rung.available && (rung.count ?? 0) > 0);
  const [picked, setPicked] = useState(0);
  // Until the counts arrive nothing is available; once they do, rest on the nearest rung
  // that is (normally the first).
  const resolved = nearestAvailable(picked, availability);
  const index = resolved < 0 ? 0 : resolved;
  const current = rungs[index]!;
  const ladder = useRef<HTMLOListElement>(null);

  const choose = useCallback(
    (target: number) => {
      const next = nearestAvailable(Math.max(0, Math.min(rungs.length - 1, target)), availability);
      if (next >= 0) setPicked(next);
    },
    // availability is rebuilt every render from metadata; its contents are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [availability.join(), rungs.length],
  );

  /** Map a pointer's height on the ladder to the rung under it. */
  const rungAt = (clientY: number): number => {
    const box = ladder.current?.getBoundingClientRect();
    if (!box || box.height <= 0) return index;
    return Math.floor(((clientY - box.top) / box.height) * rungs.length);
  };
  const dragging = useRef(false);
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    choose(rungAt(event.clientY));
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) choose(rungAt(event.clientY));
  };
  const onPointerEnd = () => {
    dragging.current = false;
  };
  /** Step to the next available rung in a direction, skipping the greyed ones. */
  const step = (direction: 1 | -1) => {
    for (let at = index + direction; at >= 0 && at < rungs.length; at += direction) {
      if (availability[at]) {
        setPicked(at);
        return;
      }
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowRight") step(1);
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") step(-1);
    else if (event.key === "Home") choose(0);
    else if (event.key === "End") choose(rungs.length - 1);
    else if (event.key === "Enter") onPick(current.track.id);
    else return;
    event.preventDefault();
  };
  const ready = resolved >= 0;

  return (
    <section
      className="vocab-onboard"
      aria-labelledby="vocab-onboard-title"
      style={
        {
          "--rung": current.color,
          // The rail is painted with the same ten colours the knob steps through.
          "--rung-scale": `linear-gradient(180deg, ${RUNG_COLORS.join(", ")})`,
          "--rung-index": index,
          "--rung-count": rungs.length,
        } as React.CSSProperties
      }
    >
      <header className="vocab-onboard-head">
        <p className="vocab-eyebrow">Bắt đầu từ đâu?</p>
        <h1 id="vocab-onboard-title">Chọn trình độ của bạn</h1>
        <p>Kéo nút trượt để xem mỗi mức trông thế nào. Đổi lại lúc nào cũng được.</p>
      </header>

      <div className="vocab-onboard-gauge">
        <ol className="vocab-onboard-ladder" ref={ladder}>
          {rungs.map((rung, at) => (
            <li
              key={rung.track.id}
              className="vocab-onboard-rung"
              data-on={at === index && ready ? "" : undefined}
              data-passed={at < index && ready ? "" : undefined}
              aria-disabled={!availability[at] || undefined}
              style={{ "--rung-own": rung.color } as React.CSSProperties}
              onClick={() => choose(at)}
            >
              <span className="vocab-onboard-name">
                <span className="vocab-onboard-label">
                  <span aria-hidden="true">{rung.track.emoji}</span> {rung.track.label}
                </span>
                <span className="vocab-onboard-meta">
                  <span className="vocab-onboard-band">{rung.band}</span>
                  {rung.count === null ? "–" : `${rung.count.toLocaleString("vi-VN")} từ`}
                </span>
              </span>
              <span className="vocab-onboard-tick" aria-hidden="true" />
              <span className="vocab-onboard-sample">
                {rung.sample ? (
                  <>
                    <strong lang="en">{rung.sample.word}</strong>
                    {/* Fixed curiosity prompt: slides in with a spring when this rung
                        becomes active, fades out when the knob moves away. */}
                    <span className="vocab-onboard-curiosity">
                      Thấy hơi lạ, bắt đầu từ đây nhé?
                    </span>
                  </>
                ) : (
                  <span className="vocab-onboard-soon">{metadata ? "Sắp có" : ""}</span>
                )}
              </span>
            </li>
          ))}
        </ol>
        {/* The rail is one element laid over the ladder's middle column, so the knob can
            travel the whole height and a drag can start anywhere along it. */}
        <div
          className="vocab-onboard-rail"
          role="slider"
          tabIndex={0}
          aria-orientation="vertical"
          aria-label="Trình độ"
          aria-valuemin={1}
          aria-valuemax={rungs.length}
          aria-valuenow={index + 1}
          aria-valuetext={`${current.track.label}, ${current.band}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onKeyDown={onKeyDown}
        >
          <span className="vocab-onboard-track" aria-hidden="true" />
          <span className="vocab-onboard-knob" aria-hidden="true" />
        </div>
      </div>

      <footer className="vocab-onboard-foot">
        <button
          type="button"
          className="vocab-onboard-go"
          disabled={!ready}
          onClick={() => onPick(current.track.id)}
        >
          {ready ? `Bắt đầu với “${current.track.label}”` : "Đang tải…"}
        </button>
        <button type="button" className="vocab-onboard-all" onClick={() => onPick(DIFFICULTY_ALL)}>
          Học mọi trình độ
        </button>
      </footer>
    </section>
  );
}
