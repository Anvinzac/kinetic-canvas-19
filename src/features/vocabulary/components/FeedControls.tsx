/** Public navigation and stream/presentation controls. Exports: FeedControls. Depends on: router, presets, difficulty tracks, transport types. */
import { Link } from "@tanstack/react-router";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  ChevronDown,
  Pause,
  Play,
  Settings,
  Shuffle,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { STYLES, THEMES } from "../lib/presets";
import { DIFFICULTY_ALL, DIFFICULTY_TRACKS, formatLevelBand } from "../lib/difficulty";
import type { NarrativeStyle } from "../lib/schema";
import type { HistoryStats } from "../lib/history";
import { useSavedCount } from "../hooks/useSavedCount";
import { useAmbientSound } from "../hooks/useAmbientSound";
import type { FeedPage, Presentation, VocabularyFilters } from "../types";

type DifficultyOption = {
  id: string;
  label: string;
  hint: string;
  band: string;
  emoji: string;
};

/**
 * The dropdown's rows: an explicit "all" escape hatch ahead of the ten tracks. In the
 * multi-select the "all" row means an EMPTY selection (no restriction), so clearing
 * every track returns to it. Each row carries a difficulty emoji so the ladder reads at
 * a glance. The list is static, so it renders before the first feed page resolves.
 */
const DIFFICULTY_OPTIONS: DifficultyOption[] = [
  { id: DIFFICULTY_ALL, label: "tất cả", hint: "Mọi trình độ", band: "", emoji: "🤯" },
  ...DIFFICULTY_TRACKS.map((track) => ({
    id: track.id,
    label: track.label,
    hint: track.hint,
    band: formatLevelBand(track.levels),
    emoji: track.emoji,
  })),
];

/** Split a committed `difficulty` value into its track ids, in canonical order. */
function parseDifficulty(value: string): string[] {
  const seen = new Set(
    value
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
  return DIFFICULTY_TRACKS.map((track) => track.id).filter((id) => seen.has(id));
}

/**
 * Summarise a selection for the trigger line: none → 🤯 "tất cả", one → that track's
 * emoji and label, several → 🧩 "tổng hợp" over the union band.
 */
function describeSelection(ids: string[]): { emoji: string; label: string; band: string } {
  if (!ids.length) return { emoji: "🤯", label: "tất cả", band: "" };
  const tracks = DIFFICULTY_TRACKS.filter((track) => ids.includes(track.id));
  if (tracks.length === 1) {
    const track = tracks[0]!;
    return { emoji: track.emoji, label: track.label, band: formatLevelBand(track.levels) };
  }
  const levels = [...new Set(tracks.flatMap((track) => track.levels))];
  return { emoji: "🧩", label: "tổng hợp", band: formatLevelBand(levels) };
}

/**
 * Difficulty picker whose trigger IS the page title: the brand sits where it always
 * did and the tagline slot reports the current selection, so the control needs no
 * separate button. It is multi-select — rows toggle into a draft and a "Done" button
 * commits it, so browsing choices never re-shuffle the live stream until confirmed. A
 * listbox rather than a native select so each row can carry its emoji, CEFR band and
 * Vietnamese gloss, and so tap targets stay large.
 * @param props Current comma-joined selection and change handler
 * @returns Brand trigger plus its popup list
 */
function DifficultyDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const listId = useId();
  const committed = useMemo(() => parseDifficulty(value), [value]);
  const summary = describeSelection(committed);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Set<string>>(() => new Set(committed));
  const [cursor, setCursor] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const close = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  };
  // Multi-select edits a draft; only "Done" commits it, so a tap never re-shuffles the
  // live stream until the reader confirms.
  const toggle = (id: string) =>
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selectAll = () => setDraft(new Set());
  const pickRow = (id: string) => (id === DIFFICULTY_ALL ? selectAll() : toggle(id));
  const commit = () => {
    onChange(
      DIFFICULTY_TRACKS.filter((track) => draft.has(track.id))
        .map((track) => track.id)
        .join(","),
    );
    close(true);
  };
  const openAt = () => {
    setDraft(new Set(committed));
    setCursor(0);
    setOpen(true);
  };

  // Move focus into the list once it mounts so arrow keys work without a tab stop.
  useEffect(() => {
    if (open) list.current?.focus();
  }, [open]);

  // A tap anywhere outside the popup closes it, matching the options-panel pattern.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (panel.current?.contains(target) || trigger.current?.contains(target)) return;
      close(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  return (
    <div className="vocab-difficulty" data-no-gesture>
      {/* The title doubles as the trigger; the tagline slot reports the current pick. */}
      <button
        ref={trigger}
        type="button"
        className="vocab-brand"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`anh.chayLá — difficulty: ${summary.label}. Change difficulty`}
        onClick={() => (open ? close(true) : openAt())}
      >
        {/* The title needs its own wrapper: .vocab-brand is a column flex, so a bare
            text node plus a span would become two stacked flex items and break
            "anh.chayLá" across two lines. */}
        <span className="vocab-brand-name">
          anh.chay<span>Lá</span>
        </span>
        <small>
          {/* Single nowrap line, taken out of flow in CSS so it can read in full
              without pushing the gear or the centred controls. */}
          <span className="vocab-difficulty-current">
            <span className="vocab-difficulty-current-emoji" aria-hidden="true">
              {summary.emoji}
            </span>
            {summary.label}
            {summary.band ? ` · ${summary.band}` : ""}
          </span>
          <ChevronDown size={12} data-open={open || undefined} aria-hidden="true" />
        </small>
      </button>
      {open && (
        <div className="vocab-difficulty-pop" ref={panel}>
          <ul
            ref={list}
            id={listId}
            role="listbox"
            aria-multiselectable
            tabIndex={-1}
            className="vocab-difficulty-options"
            aria-label="Difficulty"
            aria-activedescendant={`${listId}-opt-${cursor}`}
            onKeyDown={(event) => {
              switch (event.key) {
                case "Escape":
                  event.preventDefault();
                  close(true);
                  break;
                case "ArrowDown":
                  event.preventDefault();
                  setCursor((index) => (index + 1) % DIFFICULTY_OPTIONS.length);
                  break;
                case "ArrowUp":
                  event.preventDefault();
                  setCursor(
                    (index) => (index - 1 + DIFFICULTY_OPTIONS.length) % DIFFICULTY_OPTIONS.length,
                  );
                  break;
                case "Home":
                  event.preventDefault();
                  setCursor(0);
                  break;
                case "End":
                  event.preventDefault();
                  setCursor(DIFFICULTY_OPTIONS.length - 1);
                  break;
                case "Enter":
                case " ":
                  event.preventDefault();
                  pickRow(DIFFICULTY_OPTIONS[cursor]!.id);
                  break;
                default:
                  break;
              }
            }}
          >
            {DIFFICULTY_OPTIONS.map((option, index) => {
              const isSelected =
                option.id === DIFFICULTY_ALL ? draft.size === 0 : draft.has(option.id);
              return (
                <li
                  key={option.id}
                  id={`${listId}-opt-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  data-active={isSelected || undefined}
                  data-cursor={index === cursor || undefined}
                  className="vocab-difficulty-option"
                  onClick={() => {
                    pickRow(option.id);
                    setCursor(index);
                  }}
                  onMouseEnter={() => setCursor(index)}
                >
                  <span className="vocab-difficulty-check" aria-hidden="true">
                    {isSelected ? "✓" : ""}
                  </span>
                  <span className="vocab-difficulty-option-label">
                    <span className="vocab-difficulty-emoji" aria-hidden="true">
                      {option.emoji}
                    </span>
                    {option.label}
                  </span>
                  {option.band && <span className="vocab-difficulty-band">{option.band}</span>}
                </li>
              );
            })}
          </ul>
          <div className="vocab-difficulty-foot">
            <button type="button" className="vocab-difficulty-done" onClick={commit}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Control word selection separately from appearance. @param props Settings and callbacks. @returns Public header and options panel. */
export function FeedControls({
  metadata,
  filters,
  presentation,
  onFilters,
  onPresentation,
  onShuffle,
  open,
  onOpen,
  reducedMotion,
  historyStats,
  onClearHistory,
}: {
  metadata?: FeedPage;
  filters: VocabularyFilters;
  presentation: Presentation;
  onFilters: (value: VocabularyFilters) => void;
  onPresentation: (value: Presentation) => void;
  onShuffle: () => void;
  open: boolean;
  onOpen: (value: boolean) => void;
  reducedMotion: boolean;
  historyStats: HistoryStats;
  onClearHistory: () => void;
}) {
  const panelId = useId();
  const toggleButton = useRef<HTMLButtonElement>(null);
  const savedCount = useSavedCount();
  const ambient = useAmbientSound();
  const close = () => {
    onOpen(false);
    toggleButton.current?.focus();
  };
  return (
    <header className="vocab-toolbar">
      <div className="vocab-toolbar-row">
        {/* Left: the title (which is the difficulty trigger) with the settings gear
            tucked beside it. The gear is a bare icon, not a container button, so it
            reads as part of the header rather than a fourth control. */}
        <div className="vocab-toolbar-left">
          <DifficultyDropdown
            value={filters.difficulty}
            onChange={(difficulty) => onFilters({ ...filters, difficulty })}
          />
          <button
            className="vocab-settings-button"
            type="button"
            ref={toggleButton}
            onClick={() => (open ? close() : onOpen(true))}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? "Close feed options" : "Open feed options"}
          >
            {open ? <X size={20} /> : <Settings size={20} />}
          </button>
        </div>
        {/* Centre: the three transport controls, centred on the top edge. */}
        <div className="vocab-player-controls">
          <button
            className="vocab-icon-button"
            type="button"
            disabled={reducedMotion}
            onClick={() => onPresentation({ ...presentation, autoplay: !presentation.autoplay })}
            aria-label={presentation.autoplay && !reducedMotion ? "Pause stream" : "Play stream"}
            aria-pressed={presentation.autoplay && !reducedMotion}
          >
            {presentation.autoplay && !reducedMotion ? <Pause size={19} /> : <Play size={19} />}
          </button>
          <button
            className="vocab-icon-button"
            type="button"
            onClick={ambient.toggle}
            aria-label={ambient.enabled ? "Mute background music" : "Play background music"}
            aria-pressed={ambient.enabled}
            data-active={ambient.enabled || undefined}
          >
            {ambient.enabled ? <Volume2 size={19} /> : <VolumeX size={19} />}
          </button>
          <button
            className="vocab-icon-button"
            type="button"
            onClick={() => {
              onShuffle();
              ambient.nextTrack();
            }}
            aria-label="Shuffle words and start a new stream"
          >
            <Shuffle size={19} />
          </button>
        </div>
        {/* Right: the saved-words shortcut, pinned to the top-right corner and kept
            opaque so it is visibly distinct from the frosted player controls. */}
        <Link
          className="vocab-icon-button vocab-saved-link vocab-bookmark-button"
          to="/feed/saved"
          aria-label={
            savedCount
              ? `View your ${savedCount} saved word${savedCount === 1 ? "" : "s"}`
              : "View your saved words"
          }
        >
          <Bookmark size={19} fill={savedCount ? "currentColor" : "none"} />
          {savedCount > 0 && (
            <span className="vocab-saved-badge-count" aria-hidden="true">
              {savedCount > 99 ? "99+" : savedCount}
            </span>
          )}
        </Link>
      </div>
      {open && (
        <section
          id={panelId}
          className="vocab-options"
          aria-label="Feed options"
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
          }}
        >
          <p className="vocab-options-summary">
            {metadata
              ? `${metadata.total.toLocaleString()} distinct words in this catalog.`
              : "Your word stream is loading."}{" "}
            Every completed deck reshuffles.
          </p>
          <div className="vocab-options-secondary">
            <span className="vocab-group-label">Category, theme and reveal</span>
            <div className="vocab-select-grid">
              <label>
                Category
                <select
                  value={filters.topic}
                  onChange={(event) => onFilters({ ...filters, topic: event.target.value })}
                >
                  <option value="">All categories</option>
                  {metadata?.topics.map((topic) => (
                    <option key={topic} value={topic}>
                      {topic}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Theme
                <select
                  value={presentation.theme}
                  onChange={(event) =>
                    onPresentation({ ...presentation, theme: event.target.value })
                  }
                >
                  <option value="mix">Mix themes</option>
                  {THEMES.map((theme) => (
                    <option key={theme.id} value={theme.id}>
                      {theme.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Reveal
                <select
                  value={presentation.style}
                  onChange={(event) =>
                    onPresentation({
                      ...presentation,
                      style: event.target.value as NarrativeStyle | "mix",
                    })
                  }
                >
                  <option value="mix">Mix reveals</option>
                  {STYLES.map((style) => (
                    <option key={style.id} value={style.id}>
                      {style.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <label className="vocab-autoplay">
            <input
              type="checkbox"
              checked={presentation.autoplay && !reducedMotion}
              disabled={reducedMotion}
              onChange={(event) =>
                onPresentation({ ...presentation, autoplay: event.target.checked })
              }
            />{" "}
            Autoplay the stream
          </label>
          <p className="vocab-options-summary">
            {reducedMotion
              ? "Reduced motion is on. Clues advance manually."
              : "Clues and words play automatically for a full-screen stream. Turn off to pause."}
          </p>
          <div className="vocab-memory" aria-label="On-device viewing memory">
            <span className="vocab-group-label">On-device memory</span>
            <p className="vocab-options-summary">
              {historyStats.distinctToday} seen today · {historyStats.distinct3d} in 3 days ·{" "}
              {historyStats.distinct7d} this week. Each word returns at most once a day, twice in 3
              days, three times a week. Stored only in this browser.
            </p>
            <button type="button" className="vocab-memory-clear" onClick={onClearHistory}>
              Forget viewing history
            </button>
          </div>
          <nav aria-label="Site navigation" className="vocab-site-links">
            <Link to="/community">Community</Link>
            <Link to="/auth">Sign in</Link>
            <button type="button" onClick={close}>
              Back to words
            </button>
          </nav>
        </section>
      )}
    </header>
  );
}
