/**
 * This device's saved words, filed instead of dumped. Two tabs say which reaction put a
 * word here (bookmarks / hearts), a switch files them by the day they were saved or by
 * CEFR level, and any group longer than FOLDER_CAP words splits into collapsible folders.
 *
 * Rows carry no reaction buttons and no emoji strip: the page is for reading words you
 * kept, so removing one is a swipe or a long-press on the row, with an undo bar in case
 * the gesture was a mistake. Only the English example sentence is shown — the Vietnamese
 * gloss is already the definition line above it.
 *
 * Exports: BookmarksPage
 * Depends on: router Link, lucide icons, useSavedWords, saved-groups, i18n labels, vocabulary.css
 */

import { Link } from "@tanstack/react-router";
import { ArrowLeft, Bookmark, Heart, Undo2 } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { useSavedWords } from "../hooks/useSavedWords";
import { posLabelVi, topicLabelVi } from "../lib/i18n";
import { GROUP_MODES, groupSavedWords, type GroupMode, type WordGroup } from "../lib/saved-groups";
import type { SavedWord } from "../lib/saved-words";
import { FilledUsage, MarkedText } from "./MarkedText";
import "../vocabulary.css";

/** Which reaction defines the list on screen. */
type TabKind = "bookmark" | "heart";

const TABS: { kind: TabKind; label: string }[] = [
  { kind: "bookmark", label: "Đã lưu" },
  { kind: "heart", label: "Yêu thích" },
];

const EMPTY_COPY: Record<TabKind, { title: string; body: string }> = {
  bookmark: {
    title: "Chưa lưu từ nào",
    body: "Chạm nút lưu trên bất kỳ từ nào trong luồng để giữ lại đây — kể cả lúc chưa biết đáp án.",
  },
  heart: {
    title: "Chưa tim từ nào",
    body: "Chạm trái tim trên một từ để đánh dấu yêu thích. Những từ tim sẽ hiện ở đây.",
  },
};

/**
 * What the gesture is called on each tab. The two lists are removed differently in words
 * as well as in data: leaving a bookmark is "bỏ lưu", leaving a heart is "bỏ yêu thích".
 */
const REMOVE_COPY: Record<TabKind, { flag: string; undo: string }> = {
  bookmark: { flag: "Bỏ lưu", undo: "Đã bỏ lưu" },
  heart: { flag: "Bỏ yêu thích", undo: "Đã bỏ yêu thích" },
};

/** How far a row has to travel sideways before it counts as a swipe. */
const SWIPE_PX = 56;
/** How long a held touch counts as a long-press before it removes the row. */
const LONG_PRESS_MS = 500;
/** How long the undo offer stays up after a removal. */
const UNDO_MS = 6000;

/** One kept word. Swipe it sideways, hold it, or press Delete to take it off the list. */
function SavedRow({
  entry,
  flag,
  onRemove,
}: {
  entry: SavedWord;
  flag: string;
  onRemove: () => void;
}) {
  const [shift, setShift] = useState(0);
  const [pressing, setPressing] = useState(false);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const timer = useRef<number | null>(null);
  const settled = useRef(true);

  function clearTimer() {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function fire() {
    clearTimer();
    settled.current = true;
    origin.current = null;
    setPressing(false);
    setShift(0);
    onRemove();
  }

  function reset() {
    clearTimer();
    if (settled.current) return;
    settled.current = true;
    origin.current = null;
    setPressing(false);
    setShift(0);
  }

  const shifted = Math.abs(shift) > 8;

  function onPointerDown(event: PointerEvent<HTMLLIElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    settled.current = false;
    origin.current = { x: event.clientX, y: event.clientY };
    clearTimer();
    // A held mouse button is a click that went slightly long, so the countdown gesture
    // is reserved for touch and pen; a mouse removes a word by swiping it. The countdown
    // visual is gated on the same test, or a plain click would flash a wipe that never
    // commits.
    if (event.pointerType !== "mouse") {
      setPressing(true);
      timer.current = window.setTimeout(fire, LONG_PRESS_MS);
    }
    // Track the finger even when it slides off the row's own box. Kept last: a browser
    // that rejects the pointer id then cannot cost the rest of the gesture.
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // No capture to lose — the row still follows the pointer events it receives.
    }
  }

  function onPointerMove(event: PointerEvent<HTMLLIElement>) {
    const start = origin.current;
    if (!start || settled.current) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    // A taller-than-wide drag is the reader scrolling the page, not swiping the row,
    // so the gesture is abandoned rather than following the finger.
    if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) {
      reset();
      return;
    }
    if (Math.abs(dx) > 8) clearTimer(); // horizontal intent cancels the long-press
    setShift(Math.max(-96, Math.min(96, dx)));
    if (Math.abs(dx) >= SWIPE_PX) fire();
  }

  function onPointerUp() {
    reset();
  }

  function onKeyDown(event: KeyboardEvent<HTMLLIElement>) {
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      onRemove();
    }
  }

  return (
    <li
      className="vocab-saved-item"
      data-pressing={pressing || undefined}
      data-shifted={shifted || undefined}
      data-reveal={shifted ? (shift < 0 ? "right" : "left") : undefined}
      style={{ "--row-shift": `${shift}px` } as CSSProperties}
      tabIndex={0}
      aria-label={`${entry.word.word} — vuốt ngang hoặc nhấn giữ để ${flag.toLowerCase()}`}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onLostPointerCapture={onPointerUp}
      onKeyDown={onKeyDown}
    >
      <span className="vocab-saved-row-flag" aria-hidden="true">
        {flag}
      </span>
      <div className="vocab-saved-row-body">
        <div className="vocab-saved-word-row">
          <h3 className="vocab-saved-word" lang="en">
            {entry.word.word}
          </h3>
          <div className="vocab-saved-badges">
            {entry.word.level && <span className="vocab-saved-badge">{entry.word.level}</span>}
            {entry.word.pos && (
              <span className="vocab-saved-badge" data-plain>
                {posLabelVi(entry.word.pos)}
              </span>
            )}
            {entry.word.topic && (
              <span className="vocab-saved-badge" data-plain>
                {topicLabelVi(entry.word.topic)}
              </span>
            )}
          </div>
        </div>

        {entry.word.ipa && (
          <p className="vocab-saved-ipa" lang="en">
            {entry.word.ipa}
          </p>
        )}
        <p className="vocab-saved-def" lang="vi">
          <MarkedText text={entry.word.defVi} />
        </p>
        {entry.word.usage[0] && (
          <p className="vocab-saved-usage" lang="en">
            <FilledUsage text={entry.word.usage[0].en} word={entry.word.word} />
          </p>
        )}
      </div>
    </li>
  );
}

/** Group heading plus its folders; a folder only appears when the group outgrows one. */
function SavedFolders({
  groups,
  flag,
  onRemove,
}: {
  groups: WordGroup[];
  flag: string;
  onRemove: (entry: SavedWord) => void;
}) {
  return (
    <div className="vocab-saved-groups">
      {groups.map((group) => (
        <section className="vocab-saved-group" key={group.id}>
          <h2 className="vocab-saved-group-title">
            <span>{group.label}</span>
            {group.hint && <span className="vocab-saved-group-hint">{group.hint}</span>}
            <span className="vocab-saved-group-count">{group.count} từ</span>
          </h2>
          {group.folders.length === 1 ? (
            <ul className="vocab-saved-list">
              {group.folders[0].words.map((entry) => (
                <SavedRow
                  key={entry.word.id}
                  entry={entry}
                  flag={flag}
                  onRemove={() => onRemove(entry)}
                />
              ))}
            </ul>
          ) : (
            group.folders.map((folder, index) => (
              <details className="vocab-saved-folder" key={folder.id} open={index === 0}>
                <summary className="vocab-saved-folder-summary">
                  <span>{folder.label}</span>
                  <span className="vocab-saved-group-count">{folder.words.length} từ</span>
                </summary>
                <ul className="vocab-saved-list">
                  {folder.words.map((entry) => (
                    <SavedRow
                      key={entry.word.id}
                      entry={entry}
                      flag={flag}
                      onRemove={() => onRemove(entry)}
                    />
                  ))}
                </ul>
              </details>
            ))
          )}
        </section>
      ))}
    </div>
  );
}

/** Show this device's saved words as folders, with a swipe/hold gesture to un-save. */
export function BookmarksPage() {
  const { saved, favorites, remove, restore } = useSavedWords();
  const [tab, setTab] = useState<TabKind>("bookmark");
  const [mode, setMode] = useState<GroupMode>("day");
  const [undo, setUndo] = useState<{
    word: string;
    id: string;
    kind: TabKind;
    /** The day the row was filed under, so undo can put it back in the same group. */
    at?: number;
  } | null>(null);
  const groupId = useId();

  const counts: Record<TabKind, number> = { bookmark: saved.length, heart: favorites.length };
  const rows = tab === "bookmark" ? saved : favorites;
  const groups = groupSavedWords(rows, mode);
  const empty = EMPTY_COPY[tab];

  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), UNDO_MS);
    return () => window.clearTimeout(timer);
  }, [undo]);

  /** A tablist is expected to move between tabs with the arrow keys. */
  function onTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const at = TABS.findIndex((item) => item.kind === tab);
    const step = event.key === "ArrowRight" ? 1 : -1;
    setTab(TABS[(at + step + TABS.length) % TABS.length].kind);
  }

  function handleRemove(entry: SavedWord) {
    setUndo({ word: entry.word.word, id: entry.word.id, kind: tab, at: entry.savedAt });
    remove(entry.word.id, tab);
  }

  return (
    <main className="vocabulary-shell vocab-saved-shell">
      <header className="vocab-saved-header">
        <Link className="vocab-icon-button" to="/feed" aria-label="Về luồng từ vựng">
          <ArrowLeft size={19} />
        </Link>
        <div>
          <h1 className="vocab-saved-title">Từ vựng của bạn</h1>
          <p className="vocab-saved-subtitle">
            Lưu trên thiết bị này thôi — không tài khoản, không đăng nhập.
          </p>
        </div>
      </header>

      <div
        className="vocab-saved-tabs"
        role="tablist"
        aria-label="Danh sách từ vựng đã lưu"
        onKeyDown={onTabKeyDown}
      >
        {TABS.map((item) => (
          <button
            key={item.kind}
            type="button"
            role="tab"
            id={`${groupId}-tab-${item.kind}`}
            aria-selected={tab === item.kind}
            aria-controls={`${groupId}-panel`}
            tabIndex={tab === item.kind ? 0 : -1}
            className="vocab-saved-tab"
            data-on={tab === item.kind || undefined}
            onClick={() => setTab(item.kind)}
          >
            {item.kind === "bookmark" ? <Bookmark size={15} /> : <Heart size={15} />}
            {item.label}
            <span className="vocab-saved-tab-count">{counts[item.kind]}</span>
          </button>
        ))}
      </div>

      {/* Nothing to file while the tab is empty, so the switch waits for the first word. */}
      {rows.length > 0 && (
        <div className="vocab-saved-switch" role="group" aria-label="Cách xếp nhóm từ">
          {GROUP_MODES.map((option) => (
            <button
              key={option.id}
              type="button"
              className="vocab-saved-switch-button"
              aria-pressed={mode === option.id}
              onClick={() => setMode(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {rows.length ? (
        <div
          id={`${groupId}-panel`}
          role="tabpanel"
          aria-labelledby={`${groupId}-tab-${tab}`}
          className="vocab-saved-body"
        >
          <p className="vocab-saved-hint">
            Vuốt ngang hoặc nhấn giữ một từ để {REMOVE_COPY[tab].flag.toLowerCase()}.
          </p>
          <SavedFolders groups={groups} flag={REMOVE_COPY[tab].flag} onRemove={handleRemove} />
        </div>
      ) : (
        <div
          className="vocab-saved-empty"
          role="tabpanel"
          id={`${groupId}-panel`}
          aria-labelledby={`${groupId}-tab-${tab}`}
        >
          {tab === "bookmark" ? (
            <Bookmark size={40} strokeWidth={1.4} aria-hidden="true" />
          ) : (
            <Heart size={40} strokeWidth={1.4} aria-hidden="true" />
          )}
          <h2>{empty.title}</h2>
          <p>{empty.body}</p>
          <Link className="vocab-light-button" to="/feed">
            Về luồng từ vựng
          </Link>
        </div>
      )}

      {undo && (
        <div className="vocab-saved-undo" role="status">
          <span>
            {REMOVE_COPY[undo.kind].undo} <strong lang="en">{undo.word}</strong>
          </span>
          <button
            type="button"
            className="vocab-saved-undo-button"
            onClick={() => {
              restore(undo.id, undo.kind, undo.at);
              setUndo(null);
            }}
          >
            <Undo2 size={15} />
            Hoàn tác
          </button>
        </div>
      )}
    </main>
  );
}
