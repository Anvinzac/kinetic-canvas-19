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
  // "Done" stays hidden until the reader picks a row this session, then fades in.
  const [touched, setTouched] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
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
    setOpen(true);
  };

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
                  <span className="vocab-difficulty-count" aria-hidden="true">
                    {option.words.toLocaleString()}
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
  const [ecoOpen, setEcoOpen] = useState(false);
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
              <label>
                Giao diện
                <select
                  value={presentation.theme}
                  onChange={(event) =>
                    onPresentation({ ...presentation, theme: event.target.value })
                  }
                >
                  <option value="mix">Trộn giao diện</option>
                  {THEMES.map((theme) => (
                    <option key={theme.id} value={theme.id}>
                      {themeLabelVi(theme.id, theme.label)}
                    </option>
                  ))}
                </select>
              </label>
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
            <Link to="/auth">Đăng nhập</Link>
            <button type="button" onClick={close}>
              Về với từ vựng
            </button>
          </nav>
        </section>
      )}
    </header>
  );
}
