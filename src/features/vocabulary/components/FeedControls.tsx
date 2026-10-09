/** Public navigation and stream/presentation controls. Exports: FeedControls. Depends on: router, presets, difficulty tracks, transport types. */
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Clapperboard,
  Library,
  Pause,
  Play,
  Settings,
  Shuffle,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { COMMUNITY_AVAILABLE } from "@/lib/feature-flags";
import { EcosystemMenu } from "@/features/ecosystem/components/EcosystemMenu";
import { ECOSYSTEM_STORE_AVAILABLE } from "@/lib/feature-flags";
import { STYLES, THEMES } from "../lib/presets";
import {
  DIFFICULTY_ALL,
  DIFFICULTY_TRACKS,
  MOCK_TOTAL_WORDS,
  formatLevelBand,
  mockTrackWordCount,
} from "../lib/difficulty";
import type { NarrativeStyle } from "../lib/schema";
import type { HistoryStats } from "../lib/history";
import { styleLabelVi, themeLabelVi, topicLabelVi } from "../lib/i18n";
import { useAmbientSound } from "../hooks/useAmbientSound";
import type { FeedPage, Presentation, VocabularyFilters } from "../types";
import { usePresence } from "@/hooks/use-presence";

/** Matches the exit keyframes' duration (--dur-quick) in vocabulary.css. */
const POPUP_EXIT_MS = 180;

/**
 * Invisible full-screen catcher behind a popup. A tap on it only dismisses, so it can
 * never also turn the card page underneath the way a document-level listener let it.
 */
function PopupScrim({ closing, onDismiss }: { closing: boolean; onDismiss: () => void }) {
  return (
    <div
      className="vocab-popup-scrim"
      data-closing={closing || undefined}
      aria-hidden="true"
      onClick={onDismiss}
    />
  );
}

/**
 * Theme allow-list, deliberately the inverse of a single choice: every theme starts
 * picked and the reader only ever UNPICKS the ones they dislike, so the stream keeps
 * rotating (mix semantics) instead of wearing one skin forever. Each row leads with a
 * live gradient swatch — a theme IS its colors, and a name alone can't show that.
 * Stored as "mix" while everything is picked, else a comma-joined id list.
 */
function ThemePicker({ value, onChange }: { value: string; onChange: (theme: string) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const allIds = useMemo(() => THEMES.map((theme) => theme.id), []);
  const selected = useMemo(() => {
    const ids = value
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    return new Set(ids.length && !ids.includes("mix") ? ids : allIds);
  }, [value, allIds]);
  const isAll = selected.size === allIds.length;
  // THEMES order keeps the chips and the joined value stable across toggles.
  const pickedThemes = useMemo(() => THEMES.filter((theme) => selected.has(theme.id)), [selected]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) {
      // The stream must always have something to wear: the last theme stays pinned.
      if (next.size === 1) return;
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange(next.size === allIds.length ? "mix" : allIds.filter((id2) => next.has(id2)).join(","));
  }

  const summary = isAll
    ? "Trộn giao diện"
    : pickedThemes.length === 1
      ? themeLabelVi(pickedThemes[0].id, pickedThemes[0].label)
      : `${pickedThemes.length}/${allIds.length}`;

  return (
    <div
      className="vocab-theme-picker"
      ref={rootRef}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <span className="vocab-theme-label" id={labelId}>
        Giao diện
      </span>
      <button
        type="button"
        className="vocab-theme-trigger"
        onClick={() => (open ? setOpen(false) : setOpen(true))}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="vocab-theme-chips" aria-hidden="true">
          {pickedThemes.slice(0, 3).map((theme) => (
            <span key={theme.id} style={{ background: theme.paint }} />
          ))}
        </span>
        <span className="vocab-theme-summary">{summary}</span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div
          className="vocab-theme-list"
          role="listbox"
          aria-multiselectable="true"
          aria-labelledby={labelId}
        >
          {THEMES.map((theme) => {
            const on = selected.has(theme.id);
            return (
              <button
                key={theme.id}
                type="button"
                role="option"
                aria-selected={on}
                data-on={on || undefined}
                onClick={() => toggle(theme.id)}
              >
                <span className="vocab-theme-swatch" style={{ background: theme.paint }} />
                <span className="vocab-theme-option-label">
                  {themeLabelVi(theme.id, theme.label)}
                </span>
              </button>
            );
          })}
          {!isAll && (
            <button type="button" className="vocab-theme-reset" onClick={() => onChange("mix")}>
              Chọn lại tất cả
            </button>
          )}
        </div>
      )}
    </div>
  );
}

type DifficultyOption = {
  id: string;
  label: string;
  hint: string;
  band: string;
  /** Illustrative word count for this track's band (mock, shown at the row's right). */
  words: number;
};

/**
 * The dropdown's rows: an explicit "all" escape hatch ahead of the ten tracks. In the
 * multi-select the "all" row means an EMPTY selection (no restriction), so clearing
 * every track returns to it. Each row shows its CEFR band as a chip ahead of the name
 * and a mock total word count at the trailing edge. The list is static, so it renders
 * before the first feed page resolves.
 */
const DIFFICULTY_OPTIONS: DifficultyOption[] = [
  { id: DIFFICULTY_ALL, label: "tất cả", hint: "Mọi trình độ", band: "", words: MOCK_TOTAL_WORDS },
  ...DIFFICULTY_TRACKS.map((track) => ({
    id: track.id,
    label: track.label,
    hint: track.hint,
    band: formatLevelBand(track.levels),
    words: mockTrackWordCount(track.id),
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
 * Open state lives in the parent: the toolbar-level popup guardrail needs to know the
 * sheet is out, and one popup can never stay open while another is being reached for.
 * @param props Current comma-joined selection, change handler, and open state
 * @returns Brand trigger plus its popup list
 */
function DifficultyDropdown({
  value,
  onChange,
  open,
  onOpenChange,
}: {
  value: string;
  onChange: (next: string) => void;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const listId = useId();
  const committed = useMemo(() => parseDifficulty(value), [value]);
  const summary = describeSelection(committed);
  const [draft, setDraft] = useState<Set<string>>(() => new Set(committed));
  const [cursor, setCursor] = useState(0);
  // "Done" stays hidden until the reader picks a row this session, then fades in.
  const [touched, setTouched] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const close = (restoreFocus: boolean) => {
    onOpenChange(false);
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
  const pickRow = (id: string) => {
    setTouched(true);
    if (id === DIFFICULTY_ALL) selectAll();
    else toggle(id);
  };
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
    setTouched(false);
    onOpenChange(true);
  };

  // Sum of the packs (tracks) picked so far this session. The "tất cả" row borrows this
  // figure while a selection is pending, so it reads the combined size of the chosen
  // packs; once the selection is cleared (tapping "tất cả") it falls back to MOCK_TOTAL.
  const selectedTotal = useMemo(
    () => [...draft].reduce((sum, id) => sum + mockTrackWordCount(id), 0),
    [draft],
  );

  // Move focus into the list once it mounts so arrow keys work without a tab stop.
  useEffect(() => {
    if (open) list.current?.focus();
  }, [open]);

  const presence = usePresence(open, POPUP_EXIT_MS);

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
      {presence.mounted && <PopupScrim closing={presence.closing} onDismiss={() => close(false)} />}
      {presence.mounted && (
        <div
          className="vocab-difficulty-pop"
          data-closing={presence.closing || undefined}
          inert={presence.closing || undefined}
        >
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
              // "tất cả" reports the combined size of the packs just chosen; with no
              // selection pending it shows the whole library again.
              const count =
                option.id === DIFFICULTY_ALL && draft.size > 0 ? selectedTotal : option.words;
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
                    {/* The chip slot always renders, and every chip carries the same width
                        whether it holds "A2" or "A1–A2", so all the level names after it
                        begin on one vertical line. */}
                    <span
                      className="vocab-difficulty-band"
                      data-empty={option.band ? undefined : true}
                      aria-hidden={option.band ? undefined : true}
                    >
                      {option.band}
                    </span>
                    {option.label}
                  </span>
                  {/* key=count re-mounts the figure whenever the sum moves, which is what
                      (re)triggers the spring-and-flash CSS entrance on it. */}
                  <span className="vocab-difficulty-count" aria-hidden="true" key={count}>
                    {count.toLocaleString()}
                  </span>
                </li>
              );
            })}
          </ul>
          {/* Floating confirm bar: a gradient fade lets the last rows read through it as
              they scroll beneath, while Library and Done stay clickable above. */}
          <div className="vocab-difficulty-foot">
            <Link
              to="/feed/library"
              className="vocab-difficulty-library"
              onClick={() => close(false)}
            >
              <Library size={16} aria-hidden="true" />
              Thêm từ mới
            </Link>
            {touched && (
              <button type="button" className="vocab-difficulty-done" onClick={commit}>
                Xong
              </button>
            )}
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
  onExport,
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
  /** Open the video-export studio. Passed only for admins; absent, the control is not rendered. */
  onExport?: () => void;
}) {
  const panelId = useId();
  const toggleButton = useRef<HTMLButtonElement>(null);
  const toolbar = useRef<HTMLElement>(null);
  const ambient = useAmbientSound();
  const close = () => {
    onOpen(false);
    toggleButton.current?.focus();
  };
  const options = usePresence(open, POPUP_EXIT_MS);
  const [difficultyOpen, setDifficultyOpen] = useState(false);
  const [ecoOpen, setEcoOpen] = useState(false);
  // Guardrail while any sheet is out: the first tap on anything outside the open
  // popup — the gear, the title, a transport icon, the dock, even the empty toolbar —
  // only hides the sheet. It never also acts as a press of the control underneath,
  // so two popups can never overlap or trade places in one tap; the next tap works
  // normally. document capture (not the toolbar element) because the dock and the
  // scrims live outside the header; taps inside the sheets pass through untouched,
  // and keyboard events are not intercepted at all.
  // The listeners stay mounted for the whole session and read state through refs:
  // closing on pointerdown would otherwise re-run the effect and REMOVE the click
  // listener before the same gesture's click arrives, letting the tapped button
  // fire anyway (verified as a real leak). Instead the intercepted pointerdown arms
  // a one-shot that swallows exactly that trailing click — within a short window,
  // so a drag that never produces a click cannot eat the next real tap.
  const armedRef = useRef(false);
  const onOpenRef = useRef(onOpen);
  const swallowClickBefore = useRef(0);
  useEffect(() => {
    armedRef.current = open || difficultyOpen;
    onOpenRef.current = onOpen;
  });
  useEffect(() => {
    function onInterceptPointerDown(event: PointerEvent) {
      if (!armedRef.current) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      // instanceof Element, not HTMLElement: tapping a row's svg glyph must count as
      // inside the sheet too.
      if (target.closest(".vocab-options, .vocab-difficulty-pop")) return;
      event.preventDefault();
      event.stopPropagation();
      swallowClickBefore.current = event.timeStamp;
      setDifficultyOpen(false);
      onOpenRef.current(false);
    }
    function onInterceptClick(event: MouseEvent) {
      const armedAt = swallowClickBefore.current;
      if (!armedAt) return;
      swallowClickBefore.current = 0;
      // Only the click of the dismissing gesture itself — same time origin as
      // PointerEvent.timeStamp in every modern browser.
      if (event.timeStamp - armedAt > 700) return;
      event.preventDefault();
      event.stopPropagation();
    }
    document.addEventListener("pointerdown", onInterceptPointerDown, true);
    document.addEventListener("click", onInterceptClick, true);
    return () => {
      document.removeEventListener("pointerdown", onInterceptPointerDown, true);
      document.removeEventListener("click", onInterceptClick, true);
    };
  }, []);

  // Opening the app fan pauses the stream: the reader is looking at the menu, so
  // letting words keep turning behind it would lose them one per tick. Closing
  // restores whatever autoplay was before, rather than forcing it on.
  const resumeAfterEco = useRef(false);
  const toggleEco = useCallback(
    (next: boolean) => {
      setEcoOpen(next);
      if (next) {
        resumeAfterEco.current = presentation.autoplay;
        if (presentation.autoplay) onPresentation({ ...presentation, autoplay: false });
      } else if (resumeAfterEco.current) {
        resumeAfterEco.current = false;
        onPresentation({ ...presentation, autoplay: true });
      }
    },
    [presentation, onPresentation],
  );
  // The options sheet is notched around whichever control owns the top-right
  // corner, so it needs that control's real width — .vocab-icon-button is 44px
  // but shrinks to 34 and then 30 at narrower widths, and a hard-coded half
  // would leave the cut-out off the button on every small screen.
  useEffect(() => {
    const host = toolbar.current;
    if (!host) return;
    const corner = host.querySelector<HTMLElement>(".vocab-corner-button, .eco-trigger");
    if (!corner) return;
    const sync = () => host.style.setProperty("--vocab-corner", `${corner.offsetWidth}px`);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(corner);
    return () => observer.disconnect();
  }, []);

  /** The stream is only really playing while autoplay is on AND motion is allowed. */
  const playing = presentation.autoplay && !reducedMotion;
  return (
    <header className="vocab-toolbar" ref={toolbar}>
      <div className="vocab-toolbar-row">
        {/* Left: just the title, which is the difficulty trigger. Settings moved
            to the top-right corner — see the right column. */}
        <div className="vocab-toolbar-left">
          <DifficultyDropdown
            value={filters.difficulty}
            onChange={(difficulty) => onFilters({ ...filters, difficulty })}
            open={difficultyOpen}
            onOpenChange={setDifficultyOpen}
          />
        </div>
        {/* Centre: the three transport controls as bare icons split by two hairlines,
            centred on the top edge. */}
        <div className="vocab-player-controls">
          <button
            className="vocab-icon-button"
            type="button"
            disabled={reducedMotion}
            onClick={() => onPresentation({ ...presentation, autoplay: !presentation.autoplay })}
            aria-label={playing ? "Pause stream" : "Play stream"}
            aria-pressed={playing}
            data-active={playing || undefined}
          >
            {playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} />}
          </button>
          <span className="vocab-control-sep" aria-hidden="true" />
          <button
            className="vocab-icon-button"
            type="button"
            onClick={ambient.toggle}
            aria-label={ambient.enabled ? "Mute background music" : "Play background music"}
            aria-pressed={ambient.enabled}
            data-active={ambient.enabled || undefined}
          >
            {ambient.enabled ? <Volume2 size={19} fill="currentColor" /> : <VolumeX size={19} />}
          </button>
          <span className="vocab-control-sep" aria-hidden="true" />
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
          {onExport && (
            <button
              className="vocab-icon-button vocab-export-open"
              type="button"
              onClick={onExport}
              aria-label="Export this word as a video (admin)"
              title="Export this word as a video"
            >
              <Clapperboard size={19} />
            </button>
          )}
        </div>
        {/* Right: the corner control. While the sibling apps are unannounced the
            app panel is gone entirely and Settings takes the corner; when the
            store ships, the corner goes back to the app panel and Settings
            becomes a tile inside it. Either way the sheet pops from HERE. */}
        {ECOSYSTEM_STORE_AVAILABLE ? (
          <EcosystemMenu
            open={ecoOpen}
            onOpenChange={toggleEco}
            reducedMotion={reducedMotion}
            onOpenSettings={() => onOpen(true)}
          />
        ) : (
          <button
            className="vocab-icon-button vocab-corner-button"
            type="button"
            ref={toggleButton}
            onClick={() => (open ? close() : onOpen(true))}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? "Đóng tùy chọn" : "Mở tùy chọn luồng từ vựng"}
            data-active={open || undefined}
          >
            {open ? <X size={19} /> : <Settings size={19} />}
          </button>
        )}
      </div>
      {options.mounted && <PopupScrim closing={options.closing} onDismiss={() => onOpen(false)} />}
      {options.mounted && (
        <section
          id={panelId}
          className="vocab-options"
          data-closing={options.closing || undefined}
          inert={options.closing || undefined}
          aria-label="Tùy chọn luồng từ vựng"
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
          }}
        >
          <p className="vocab-options-summary">
            {metadata
              ? `Danh mục này có ${metadata.total.toLocaleString("vi-VN")} từ khác nhau.`
              : "Luồng từ vựng của bạn đang tải."}{" "}
            Hết một vòng là xáo trộn lại từ đầu.
          </p>
          <div className="vocab-options-secondary">
            <span className="vocab-group-label">Chủ đề, giao diện và cách hiện đáp án</span>
            <div className="vocab-select-grid">
              <label>
                Chủ đề
                <select
                  value={filters.topic}
                  onChange={(event) => onFilters({ ...filters, topic: event.target.value })}
                >
                  <option value="">Mọi chủ đề</option>
                  {metadata?.topics.map((topic) => (
                    <option key={topic} value={topic}>
                      {topicLabelVi(topic)}
                    </option>
                  ))}
                </select>
              </label>
              <ThemePicker
                value={presentation.theme}
                onChange={(theme) => onPresentation({ ...presentation, theme })}
              />
              <label>
                Cách hiện
                <select
                  value={presentation.style}
                  onChange={(event) =>
                    onPresentation({
                      ...presentation,
                      style: event.target.value as NarrativeStyle | "mix",
                    })
                  }
                >
                  <option value="mix">Trộn cách hiện</option>
                  {STYLES.map((style) => (
                    <option key={style.id} value={style.id}>
                      {styleLabelVi(style.id, style.label)}
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
            Tự động phát luồng
          </label>
          <p className="vocab-options-summary">
            {reducedMotion
              ? "Bạn đang bật chế độ giảm chuyển động, nên gợi ý lật thủ công."
              : "Gợi ý và từ ngữ tự động chạy hết màn hình. Tắt đi để tạm dừng."}
          </p>
          <div className="vocab-memory" aria-label="Bộ nhớ lượt xem trên thiết bị">
            <span className="vocab-group-label">Bộ nhớ trên thiết bị</span>
            <p className="vocab-options-summary">
              Hôm nay đã xem {historyStats.distinctToday} từ · 3 ngày qua {historyStats.distinct3d}{" "}
              · tuần này {historyStats.distinct7d}. Mỗi từ chỉ quay lại tối đa một lần mỗi ngày, hai
              lần trong ba ngày và ba lần mỗi tuần. Tất cả chỉ lưu trong trình duyệt này.
            </p>
            <button type="button" className="vocab-memory-clear" onClick={onClearHistory}>
              Quên lịch sử đã xem
            </button>
          </div>
          <nav aria-label="Điều hướng trang" className="vocab-site-links">
            {/* Community is not open to readers yet; only the button is hidden, the
                /community route still resolves. Flip COMMUNITY_AVAILABLE to bring it back. */}
            {COMMUNITY_AVAILABLE && <Link to="/community">Cộng đồng</Link>}
            {/* Temporarily hidden at request: "Đăng nhập" and "Về với từ vựng" leave the
                sheet for now — uncomment (both live together) to bring them back. The
                /auth route and the close behaviour are untouched.
            <Link to="/auth">Đăng nhập</Link>
            <button type="button" onClick={close}>
              Về với từ vựng
            </button>
            */}
          </nav>
        </section>
      )}
    </header>
  );
}
