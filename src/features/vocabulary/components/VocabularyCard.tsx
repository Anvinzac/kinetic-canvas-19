/** One independent vocabulary learning card; clue navigation and heart/bookmark reactions stay on-device, and the reveal is followed by a letter-by-letter spelling coda. Exports: VocabularyCard. Depends on: presets, playback, VocabularyStage, SpellingAnimation, reactions. */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { blendOklch, getCanvasPatternTheme, getCanvasSceneTheme } from "@/features/canvas";
import {
  PostCanvasBackdrop,
  getSlidingCanvasBackground,
  getPageDuration,
  getUniformPageTextSize,
} from "@/features/post-player";
import { AnimatePresence, animate, motion, useMotionValue } from "framer-motion";
import { SPRING, getBeatSeconds } from "@/lib/motion";
import { Bookmark, Heart } from "lucide-react";
import { buildVocabularyCanvas, choosePresentation, fitVocabularyTextSize } from "../lib/presets";
import { buildStages } from "../lib/stages";
import { getExportStageBox, type CardExportLayout } from "../lib/export-layout";
import { hasReportedWord } from "../lib/reported-words";
import { sceneSkipLimiter } from "../lib/skip-limiter";
import { getSpellingDurationMs, pickSpellingVariant } from "../lib/spelling";
import {
  REACTIONS_EVENT,
  REACTIONS_KEY,
  addEmojiComment,
  flipReaction,
  getEmojiComments,
  getTapCount,
  hasReaction,
  type ReactionKind,
} from "../lib/reactions";
import { EMOJI_PALETTE, formatEmojiTotal, mockEmojiTotals, withLocalEmojis } from "../lib/emoji";
import { useLearningPlayback } from "../hooks/useLearningPlayback";
import { usePresence } from "@/hooks/use-presence";
import type { FeedEntry, Presentation } from "../types";
import { EmojiBurst } from "./EmojiBurst";
import { SpellingAnimation } from "./SpellingAnimation";
import { VocabularyStage } from "./VocabularyStage";
import { WordReportButton, WordReportPanel } from "./WordReportControl";

/** Matches the report panel's exit keyframes (--dur-quick) in vocabulary.css. */
const REPORT_EXIT_MS = 180;
/** Horizontal travel before a drag starts moving the page, in px. */
const DRAG_SLOP_PX = 10;
/** Share of the finger's travel the page follows — under 1 so it feels held, not loose. */
const DRAG_FOLLOW = 0.42;

/** Play a single occurrence, keeping answer content hidden until reveal. @param props Entry/display settings. @returns Full-height card. */
export function VocabularyCard({
  entry,
  presentation,
  active,
  reducedMotion,
  matching,
  canAdvance,
  onAdvance,
  onWordEnding,
  exportLayout,
  revealButtonLabel,
}: {
  entry: FeedEntry;
  presentation: Presentation;
  active: boolean;
  reducedMotion: boolean;
  matching: number;
  canAdvance: boolean;
  onAdvance: () => void;
  /**
   * Called when this card, while on screen, reaches its final page (the spelling
   * coda), with the milliseconds left before the stream moves on — 0 when pages are
   * turned by hand and there is no telling. Lets the music bow out with the word.
   */
  onWordEnding?: (remainingMs: number) => void;
  /**
   * Render for video export instead of for a reader: the text is confined to the
   * given clear zone, the interactive chrome is hidden and gestures are off. The
   * animation, timing and palette are exactly the feed's.
   */
  exportLayout?: CardExportLayout;
  /** Custom label for the reveal button, from admin wording presets. */
  revealButtonLabel?: string;
}) {
  const { theme, style } = choosePresentation(entry.occurrenceId, presentation, entry.position);
  const stages = useMemo(() => buildStages(entry.word, style.id), [entry.word, style.id]);
  const canvas = useMemo(() => buildVocabularyCanvas(theme, style), [theme, style]);
  // The spelling coda is one extra page appended after the reveal stage, so the
  // playback timer — not the animation component — decides when the card ends.
  const spellingVariant = useMemo(
    () => pickSpellingVariant(entry.occurrenceId),
    [entry.occurrenceId],
  );
  const spellingDuration = useMemo(
    () => getSpellingDurationMs(entry.word.word, spellingVariant, reducedMotion),
    [entry.word.word, spellingVariant, reducedMotion],
  );
  const revealPage = stages.length - 1;
  const pageCount = stages.length + 1;
  /** Progress-bar keys: one per clue stage plus the trailing spelling coda. */
  const pageKeys = useMemo(() => [...stages.map((item) => item.id), "spelling"], [stages]);
  const cardRef = useRef<HTMLElement>(null);
  const actionBarRef = useRef<HTMLDivElement>(null);
  const emojiStripRef = useRef<HTMLDivElement>(null);
  const [{ width, height }, setSize] = useState({ width: 390, height: 844 });
  useLayoutEffect(() => {
    const element = cardRef.current;
    if (!element) return;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  /** One duration per page: every clue stage plus the trailing spelling coda. */
  const pageDurations = useMemo(
    () => [
      ...stages.map((stage) =>
        getPageDuration(
          [stage.text, stage.reveal ? entry.word.defVi : ""].filter(Boolean).join(" "),
          style.tempo,
          style.rhythm,
        ),
      ),
      spellingDuration,
    ],
    [stages, entry.word.defVi, style.tempo, style.rhythm, spellingDuration],
  );
  // While the report panel is open the card holds still: the reader is describing
  // THIS page, and the stream must not move on underneath them.
  const [reportOpen, setReportOpen] = useState(false);
  const [reported, setReported] = useState(() => hasReportedWord(entry.word.id));
  const reportButton = useRef<HTMLButtonElement>(null);
  const closeReport = useCallback(() => {
    setReportOpen(false);
    reportButton.current?.focus();
  }, []);
  const report = usePresence(reportOpen, REPORT_EXIT_MS);
  const markReported = useCallback(() => setReported(true), []);
  const playback = useLearningPlayback({
    count: pageCount,
    active,
    autoplay: presentation.autoplay && !reportOpen,
    reducedMotion,
    durations: pageDurations,
    canAdvance,
    revealPage,
    onFinish: onAdvance,
  });
  // Which way the reader last moved, derived during render so the outgoing page
  // already knows its exit direction on the same pass that swaps it out.
  const [nav, setNav] = useState({ page: 0, direction: 1 });
  if (nav.page !== playback.page) {
    setNav({ page: playback.page, direction: playback.page > nav.page ? 1 : -1 });
  }
  const isSpelling = playback.page > revealPage;
  const autoAdvancing = playback.playing && canAdvance;
  useEffect(() => {
    if (!active || !isSpelling) return;
    onWordEnding?.(autoAdvancing ? spellingDuration : 0);
  }, [active, isSpelling, autoAdvancing, spellingDuration, onWordEnding]);
  // The reveal page and the spelling coda both belong to the answer, so the emoji
  // burst stays mounted across the flip instead of remounting and restarting.
  const isRevealed = playback.page >= revealPage;
  // The burst fills both pages and fades out as the spelled word leaves.
  const burstSpanSeconds = ((pageDurations[revealPage] ?? 0) + spellingDuration) / 1000;
  // During the coda there is no matching stage; the answer stage stays mounted
  // underneath so its reveal details and unlocked reactions persist.
  const stage = stages[Math.min(playback.page, revealPage)]!;
  // The emoji strip is the chrome for the WHOLE answer — the reveal page and the
  // trailing spelling coda — and is dropped only when a new word's card mounts. It no
  // longer swaps away at the reveal→spelling flip, which flickered the strip (and its
  // badge counts) off mid-answer for no reason.
  const showEmojiStrip = isRevealed;
  const playKey = playback.replay * pageCount + playback.page;
  // The burst billows out of each emoji's OWN button instead of out of the card's
  // corners, so every button's launch point is measured from the strip. The strip now
  // stays mounted across the whole answer, so this runs once when it appears and the
  // base positions of glyphs already in flight never move on the reveal→spelling flip.
  const [burstOrigin, setBurstOrigin] = useState({ x: 195, y: 702 });
  const [emojiOrigins, setEmojiOrigins] = useState<Record<string, { x: number; y: number }>>({});
  useLayoutEffect(() => {
    const card = cardRef.current;
    const bar = actionBarRef.current;
    if (!card || !bar || !showEmojiStrip) return;
    const cardRect = card.getBoundingClientRect();
    const barRect = bar.getBoundingClientRect();
    setBurstOrigin({
      x: barRect.left - cardRect.left + barRect.width / 2,
      y: barRect.top - cardRect.top,
    });
    const strip = emojiStripRef.current;
    if (!strip) return;
    const next: Record<string, { x: number; y: number }> = {};
    strip
      .querySelectorAll<HTMLButtonElement>(".vocab-emoji-strip-btn[data-emoji]")
      .forEach((button) => {
        const emoji = button.dataset.emoji;
        if (!emoji) return;
        const rect = button.getBoundingClientRect();
        next[emoji] = {
          x: rect.left - cardRect.left + rect.width / 2,
          y: rect.top - cardRect.top + rect.height / 2,
        };
      });
    setEmojiOrigins(next);
  }, [showEmojiStrip, width, height]);
  const sceneTheme = getCanvasSceneTheme(canvas.backgroundScene);
  const patternTheme = getCanvasPatternTheme(canvas.backgroundPattern);
  const sliding =
    sceneTheme || patternTheme
      ? null
      : getSlidingCanvasBackground(
          canvas,
          theme.background,
          reducedMotion ? 0 : playback.page,
          // Blend each step perceptually so the strip keeps its color through the
          // middle of the card, matching the static `theme.paint` on idle cards.
          blendOklch,
        );
  // Only the single active card animates the sweeping transition backdrop. Inactive
  // neighbours keep a static gradient, so a transient active-index flip can never make
  // every visible background strobe at once.
  const sweep = !!sliding && !reducedMotion && active;
  const cluePages = stages.filter((item) => !item.reveal).map((item) => item.text);
  // In an export the text lives in the frame's clear zone, so that zone — not the
  // whole card — is the width and height everything is fitted to.
  const exportBox = exportLayout ? getExportStageBox(width, height, exportLayout) : null;
  const textWidth = exportBox?.textWidth ?? width;
  const textSize = fitVocabularyTextSize(
    stage.text,
    getUniformPageTextSize(
      Math.max(96, Math.min(160, textWidth * 0.13)),
      cluePages,
      cluePages.join(" "),
    ),
    textWidth,
    exportBox?.textHeight ?? height,
    exportBox ? 0 : undefined,
  );
  // Every role comes from one validated palette. `--vocab-button-ink` is the
  // palette's on-accent color, which the audit already proved clears 4.5:1 against
  // both accents, so a label painted on an accent fill can never go unreadable.
  const colors = {
    "--vocab-ink": theme.ink,
    "--vocab-accent": theme.accent,
    "--vocab-accent-alt": theme.accentAlt,
    "--vocab-button-ink": theme.onAccent,
    // One pulse per card: emphasis loops, the backdrop drift and the blank slot are
    // all whole multiples of this, so the page moves to the style's tempo.
    "--kinetic-beat": `${getBeatSeconds(style.tempo)}s`,
    background: theme.paint,
    color: theme.ink,
    fontFamily: `${theme.font}, sans-serif`,
    ...(exportLayout && exportBox
      ? {
          "--safe-top": `${exportLayout.safe.top * 100}%`,
          "--safe-right": `${exportLayout.safe.right * 100}%`,
          "--safe-bottom": `${exportLayout.safe.bottom * 100}%`,
          "--safe-left": `${exportLayout.safe.left * 100}%`,
          "--export-stage-top": `${exportBox.top}px`,
          "--export-stage-bottom": `${exportBox.bottom}px`,
          "--export-stage-bottom-band": `${exportBox.bottomBand}px`,
        }
      : {}),
  } as CSSProperties;

  // Gesture handling: tap left/right + horizontal swipe for clue navigation.
  const gestureStart = useRef<{ x: number; y: number; t: number } | null>(null);
  // The page follows the finger while it is dragged sideways and springs back on
  // release, so a swipe is felt before it commits rather than jumping at a threshold.
  const dragX = useMotionValue(0);
  const handlePointerMove = useCallback(
    (clientX: number, clientY: number) => {
      const start = gestureStart.current;
      if (!start || reducedMotion) return;
      const dx = clientX - start.x;
      const dy = clientY - start.y;
      // Only a clearly horizontal drag moves the page; vertical travel belongs to the
      // stream's own scroll and must not wobble the text.
      if (Math.abs(dx) > DRAG_SLOP_PX && Math.abs(dx) > Math.abs(dy) * 1.2) {
        dragX.set(dx * DRAG_FOLLOW);
      }
    },
    [dragX, reducedMotion],
  );
  const releaseDrag = useCallback(() => {
    if (dragX.get() !== 0) animate(dragX, 0, SPRING.snappy);
  }, [dragX]);
  const handlePointerStart = useCallback(
    (clientX: number, clientY: number, target: EventTarget | null) => {
      if (
        target instanceof Element &&
        target.closest("button, a, input, select, textarea, [data-no-gesture]")
      ) {
        // Element (not HTMLElement): taps land on SVG icons inside buttons, and
        // SVGElement must be excluded or reaction taps would also flip pages.
        gestureStart.current = null;
        return;
      }
      gestureStart.current = { x: clientX, y: clientY, t: Date.now() };
    },
    [],
  );
  const handlePointerEnd = useCallback(
    (clientX: number, clientY: number) => {
      const start = gestureStart.current;
      gestureStart.current = null;
      releaseDrag();
      if (!start) return;
      const dx = clientX - start.x;
      const dy = clientY - start.y;
      const dt = Date.now() - start.t;
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      // Forward skips share one limiter; once it trips, the gesture is swallowed silently.
      const canSkip = () => sceneSkipLimiter.tryConsume();
      // Horizontal swipe
      if ((ax > 44 || ay > 44) && ax > ay) {
        if (dx < -44) {
          if (isSpelling) {
            if (canSkip()) onAdvance();
          } else if (!stage.reveal && canSkip()) playback.next();
        } else if (dx > 44) {
          playback.previous();
        }
        return;
      }
      // Vertical swipe is handled by VocabularyStream for word navigation; ignore here.
      if (ay > 44 && ay > ax) return;
      // Tap
      if (dt < 600 && ax < 16 && ay < 16) {
        // During the spelling coda a tap means "I have it" — skip to the next word.
        if (isSpelling) {
          if (canSkip()) onAdvance();
          return;
        }
        const rect = cardRef.current?.getBoundingClientRect();
        if (!rect) return;
        const relX = clientX - rect.left;
        const leftZone = rect.width * 0.33;
        const rightZone = rect.width * 0.66;
        if (relX < leftZone) {
          playback.previous();
        } else if (relX > rightZone) {
          if (stage.reveal) playback.restart();
          else if (canSkip()) playback.next();
        } else {
          // Center tap reveals or restarts
          if (stage.reveal) playback.restart();
          else if (canSkip()) playback.reveal();
        }
      }
    },
    [playback, stage.reveal, isSpelling, onAdvance, releaseDrag],
  );

  void matching;

  // Heart / bookmark: everything stays on-device. Both the toggle flag and the
  // cumulative tap counter live in localStorage, so no request is made and no
  // account exists — the numbers shown are this reader's own.
  const wordId = entry.word.id;
  const [reactions, setReactions] = useState(() => ({
    heart: hasReaction(wordId, "heart"),
    bookmark: hasReaction(wordId, "bookmark"),
  }));
  const [taps, setTaps] = useState(() => ({
    heart: getTapCount(wordId, "heart"),
    bookmark: getTapCount(wordId, "bookmark"),
  }));
  // This device's own emoji taps, folded on top of the mocked aggregate so a tap
  // visibly adds to the crowd. Held in state (not read during render) so its
  // identity is stable and the burst cannot restart on an unrelated re-render.
  const [emojiComments, setEmojiComments] = useState(() => getEmojiComments(wordId));
  const readLocalReactions = useCallback(() => {
    setReactions({
      heart: hasReaction(wordId, "heart"),
      bookmark: hasReaction(wordId, "bookmark"),
    });
    setTaps({
      heart: getTapCount(wordId, "heart"),
      bookmark: getTapCount(wordId, "bookmark"),
    });
    setEmojiComments(getEmojiComments(wordId));
  }, [wordId]);
  useEffect(() => {
    readLocalReactions();
  }, [readLocalReactions, active]);
  // The cycling stream can mount the same word twice, and the saved-words page
  // writes the same key, so re-read on both the cross-tab and same-tab signal.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === REACTIONS_KEY) readLocalReactions();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(REACTIONS_EVENT, readLocalReactions);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(REACTIONS_EVENT, readLocalReactions);
    };
  }, [readLocalReactions]);
  // Bumped each time a reaction is switched ON, and used as a React key on the icon:
  // a fresh key remounts it, which replays the pop. Starting at 0 means an already
  // saved word does not celebrate itself every time its card scrolls into view.
  // `onStrip` records which row the tap happened in: the action row and the emoji
  // strip each render their own heart/bookmark, and the strip mounting at the reveal
  // must not replay a pop that was earned on the other row.
  const [pops, setPops] = useState({ heart: 0, bookmark: 0, onStrip: false });
  const toggleReaction = useCallback(
    (kind: ReactionKind) => {
      // Reactions are always live — no pre-reveal lock. flipReaction bumps the tap
      // counter itself when the reaction turns on.
      const turningOn = !hasReaction(wordId, kind);
      flipReaction(wordId, kind);
      readLocalReactions();
      if (turningOn) {
        setPops((current) => ({
          ...current,
          [kind]: current[kind] + 1,
          onStrip: showEmojiStrip,
        }));
      }
    },
    [wordId, readLocalReactions, showEmojiStrip],
  );
  const heartsLabel = formatReactionCount(taps.heart);
  const bookmarksLabel = formatReactionCount(taps.bookmark);

  // The reveal page billows the word's mocked emoji aggregate out of the reaction
  // button. The aggregate is deterministic per word id, so a replay looks the
  // same and neighbouring cards differ.
  const emojiTotals = useMemo(() => mockEmojiTotals(wordId), [wordId]);
  // The badges show the mocked crowd plus this device's taps per emoji; the flying
  // glyphs stay keyed to the mocked aggregate alone so a tap cannot restart the long
  // flight.
  const emojiCounts = useMemo(
    () => withLocalEmojis(emojiTotals, emojiComments).counts,
    [emojiTotals, emojiComments],
  );
  // The last emoji tapped and how many taps there have been, so that emoji alone
  // replays its bounce and floats a "+1" — feedback the strip never gave before.
  const [emojiTap, setEmojiTap] = useState<{ emoji: string; count: number }>();
  const handleEmojiTap = useCallback(
    (emoji: string) => {
      addEmojiComment(wordId, emoji);
      setEmojiComments(getEmojiComments(wordId));
      setEmojiTap((current) => ({ emoji, count: (current?.count ?? 0) + 1 }));
    },
    [wordId],
  );

  return (
    <article
      ref={cardRef}
      className="vocab-card"
      style={colors}
      data-theme={theme.id}
      data-tone={theme.tone}
      data-export={exportLayout ? "" : undefined}
      data-export-progress={exportLayout?.showProgress || undefined}
      data-stage={isSpelling ? "spelling" : stage.id}
      inert={!active}
      aria-hidden={!active}
      aria-label={`Vocabulary card ${entry.position + 1}`}
      aria-posinset={entry.position + 1}
      aria-setsize={-1}
      onTouchStart={(e) => {
        const t = e.touches[0];
        if (t) handlePointerStart(t.clientX, t.clientY, e.target);
      }}
      onTouchMove={(e) => {
        const t = e.touches[0];
        if (t) handlePointerMove(t.clientX, t.clientY);
      }}
      onTouchEnd={(e) => {
        const t = e.changedTouches[0];
        if (t) handlePointerEnd(t.clientX, t.clientY);
      }}
      onTouchCancel={() => {
        gestureStart.current = null;
        releaseDrag();
      }}
      onMouseDown={(e) => {
        // Only for desktop click preview; store for mouse up
        if (e.button !== 0) return;
        handlePointerStart(e.clientX, e.clientY, e.target);
      }}
      onMouseUp={(e) => handlePointerEnd(e.clientX, e.clientY)}
    >
      <div className="vocab-backdrop" aria-hidden="true">
        {/* The backdrop, not the text, carries the idle motion: a slow sideways
            drift of the gradient itself. It only moves colors that are already in
            the palette, so the audited contrast floors hold wherever it drifts. */}
        <div className="vocab-backdrop-drift" data-drift={sweep || undefined}>
          <PostCanvasBackdrop
            postId={entry.occurrenceId}
            backgroundShiftPage={reducedMotion ? 0 : playback.page}
            sceneTheme={sceneTheme}
            patternTheme={patternTheme}
            slidingCanvasBackground={sliding}
            staticCanvasBackground={theme.paint}
            hasTransitionBackground={sweep}
          />
        </div>
      </div>
      {isSpelling ? (
        <SpellingAnimation
          word={entry.word.word}
          variant={spellingVariant}
          reducedMotion={reducedMotion}
        />
      ) : (
        <VocabularyStage
          stage={stage}
          word={entry.word}
          spec={{ ...canvas, text: stage.text, size: stage.reveal ? 128 : textSize }}
          background={theme.background}
          canvasWidth={textWidth}
          active={active}
          playing={playback.playing}
          reducedMotion={reducedMotion}
          playKey={playKey}
          direction={nav.direction}
          dragX={dragX}
        />
      )}
      {isRevealed && (
        <EmojiBurst
          wordId={wordId}
          totals={emojiTotals}
          width={width}
          height={height}
          origins={emojiOrigins}
          originX={burstOrigin.x}
          originY={burstOrigin.y}
          spanSeconds={burstSpanSeconds}
          reducedMotion={reducedMotion}
        />
      )}
      {exportLayout?.showBrand && (
        <p className="vocab-export-brand" aria-hidden="true">
          anh.chay<span>Lá</span>
        </p>
      )}
      {!isSpelling && <p className="vocab-stage-label">{stage.label}</p>}
      <div className="vocab-progress" aria-label={`Page ${playback.page + 1} of ${pageCount}`}>
        {pageKeys.map((key, index) => (
          <span key={key} data-complete={index < playback.page}>
            {index === playback.page && (
              <i
                key={`${playKey}-${playback.playing}`}
                style={{
                  animationDuration: `${playback.duration}ms`,
                  animationPlayState: playback.playing ? "running" : "paused",
                }}
              />
            )}
          </span>
        ))}
      </div>

      {!exportLayout && report.mounted && (
        <WordReportPanel
          closing={report.closing}
          wordId={wordId}
          stageId={isSpelling ? "spelling" : stage.id}
          alreadyReported={reported}
          onSent={markReported}
          onClose={closeReport}
        />
      )}
      <div
        className="vocab-action-bar"
        ref={actionBarRef}
        data-anticipation={showEmojiStrip || undefined}
        data-no-gesture
      >
        {/* The report button keeps the left end of the row to itself and stays put
            across the reveal; the reveal / heart / bookmark group (and later the emoji
            strip) is centred in the room beside it. */}
        <WordReportButton
          buttonRef={reportButton}
          open={reportOpen}
          reported={reported}
          onToggle={() => (reportOpen ? closeReport() : setReportOpen(true))}
        />
        <div className="vocab-action-main">
          <AnimatePresence mode="wait">
            {showEmojiStrip ? (
              <motion.div
                key="emoji-strip"
                ref={emojiStripRef}
                className="vocab-emoji-strip"
                initial={{ opacity: 0, scale: 0.85, filter: "blur(4px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.85, filter: "blur(4px)" }}
                transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                {EMOJI_PALETTE.map((emoji) => {
                  const count = emojiCounts[emoji] ?? 0;
                  const tapped = emojiTap?.emoji === emoji;
                  return (
                    <button
                      key={emoji}
                      type="button"
                      className="vocab-emoji-strip-btn"
                      data-emoji={emoji}
                      onClick={() => handleEmojiTap(emoji)}
                      aria-label={`React with ${emoji}${count ? `, ${count} so far` : ""}`}
                    >
                      <span
                        key={`glyph-${tapped ? emojiTap.count : 0}`}
                        className="vocab-emoji-glyph"
                        data-pop={tapped || undefined}
                      >
                        {emoji}
                      </span>
                      {tapped && (
                        <span
                          key={`plus-${emojiTap.count}`}
                          className="vocab-emoji-plus"
                          aria-hidden="true"
                        >
                          +1
                        </span>
                      )}
                      {count > 0 && (
                        // Keyed on the value so a changed count rolls in instead of
                        // silently swapping its digits.
                        <span
                          key={`count-${count}`}
                          className="vocab-emoji-strip-count"
                          aria-hidden="true"
                        >
                          {formatEmojiTotal(count)}
                        </span>
                      )}
                    </button>
                  );
                })}
                <div className="vocab-emoji-strip-sep" aria-hidden="true" />
                <button
                  type="button"
                  className="vocab-emoji-strip-btn vocab-reaction-heart"
                  data-on={reactions.heart || undefined}
                  onClick={() => toggleReaction("heart")}
                  aria-label={
                    reactions.heart ? "Remove your heart from this word" : "Heart this word"
                  }
                >
                  <span
                    key={pops.heart}
                    className="vocab-pop"
                    data-pop={(pops.onStrip && pops.heart > 0) || undefined}
                  >
                    <Heart size={16} fill={reactions.heart ? "currentColor" : "none"} />
                  </span>
                </button>
                <button
                  type="button"
                  className="vocab-emoji-strip-btn vocab-reaction-bookmark"
                  data-on={reactions.bookmark || undefined}
                  onClick={() => toggleReaction("bookmark")}
                  aria-label={reactions.bookmark ? "Remove this word from saved" : "Save this word"}
                >
                  <span
                    key={pops.bookmark}
                    className="vocab-pop"
                    data-pop={(pops.onStrip && pops.bookmark > 0) || undefined}
                  >
                    <Bookmark size={16} fill={reactions.bookmark ? "currentColor" : "none"} />
                  </span>
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="action-bar"
                className="vocab-action-row"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: reducedMotion ? 0 : 0.22 }}
              >
                {!stage.reveal && (
                  <button
                    type="button"
                    className="vocab-reveal-button vocab-reveal-pill"
                    onClick={playback.reveal}
                    aria-label="Reveal word"
                  >
                    {revealButtonLabel || "Ê, từ này biết nè"}
                  </button>
                )}
                <div className="vocab-reaction">
                  <button
                    type="button"
                    className="vocab-reaction-button vocab-reaction-heart"
                    data-on={reactions.heart || undefined}
                    onClick={() => toggleReaction("heart")}
                    aria-label={
                      reactions.heart ? "Remove your heart from this word" : "Heart this word"
                    }
                  >
                    <span
                      key={pops.heart}
                      className="vocab-pop"
                      data-pop={(!pops.onStrip && pops.heart > 0) || undefined}
                    >
                      <Heart size={17} fill={reactions.heart ? "currentColor" : "none"} />
                    </span>
                  </button>
                  <span key={heartsLabel} className="vocab-reaction-count">
                    {heartsLabel}
                  </span>
                </div>
                <div className="vocab-reaction">
                  <button
                    type="button"
                    className="vocab-reaction-button vocab-reaction-bookmark"
                    data-on={reactions.bookmark || undefined}
                    onClick={() => toggleReaction("bookmark")}
                    aria-label={
                      reactions.bookmark ? "Remove this word from saved" : "Save this word"
                    }
                  >
                    <span
                      key={pops.bookmark}
                      className="vocab-pop"
                      data-pop={(!pops.onStrip && pops.bookmark > 0) || undefined}
                    >
                      <Bookmark size={17} fill={reactions.bookmark ? "currentColor" : "none"} />
                    </span>
                  </button>
                  <span key={bookmarksLabel} className="vocab-reaction-count">
                    {bookmarksLabel}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </article>
  );
}

/** Compact local tap-count label shown under a reaction button. */
function formatReactionCount(value: number): string {
  if (!value) return "";
  if (value >= 1000) {
    const thousands = value / 1000;
    return `${thousands >= 10 ? Math.round(thousands) : thousands.toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(value);
}
