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
import {
  ArrowLeft,
  Bookmark,
  ChevronDown,
  ChevronsUpDown,
  FoldVertical,
  Heart,
  Undo2,
  X,
} from "lucide-react";
import {
  Fragment,
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
import { groupSavedWords, type WordGroup } from "../lib/saved-groups";
import type { SavedWord } from "../lib/saved-words";
import { FilledUsage, MarkedText } from "./MarkedText";
import "../vocabulary.css";

/** Which reaction defines the list on screen. */
type TabKind = "bookmark" | "heart";

const TABS: { kind: TabKind; label: string }[] = [
  { kind: "bookmark", label: "Đã lưu" },
  { kind: "heart", label: "Yêu thích" },
];

const EMPTY_COPY: Record<TabKind, { title: string; body: string; short: string }> = {
  bookmark: {
    title: "Kho từ đang trống",
    body: "Chạm nút dấu trang dưới mỗi từ để cất vào kho — kể cả lúc chưa lộ đáp án. Trái tim ngay bên cạnh sẽ xếp từ vào mục Yêu thích.",
    short: "Chạm dấu trang dưới một từ để cất vào kho.",
  },
  heart: {
    title: "Chưa có từ yêu thích",
    body: "Chạm trái tim dưới một từ để cất vào đây. Nút dấu trang ngay bên cạnh sẽ xếp từ vào mục Đã lưu.",
    short: "Chạm trái tim dưới một từ để cất vào đây.",
  },
};

/** One short, chatty line per key, shown in the empty vault's two tooltips. */
const TIP_COPY: Record<TabKind, string> = {
  bookmark: "lưu từ chưa biết nha",
  heart: "giữ từ iu thích nà",
};

/**
 * A tooltip bubble in the empty vault. The sentence is split per WORD so each one can be
 * animated in on its own beat — a block of text appearing at once reads as a label, while
 * words arriving one after another reads as someone talking, which is the point here.
 *
 * The bubble's body and tail live in one `.vocab-vault-tip-shape` layer behind the text:
 * the outline is drawn by a filter over that layer, so box and tail are outlined as a
 * SINGLE silhouette with no seam where they meet. Putting the text in the same layer would
 * have the filter trace every glyph too.
 * @param kind - Which key this bubble points at
 * @param active - Whether that key's tab is the one on screen
 */
function VaultTip({ kind }: { kind: TabKind }): React.ReactElement {
  return (
    <span className="vocab-vault-tip" data-tip={kind}>
      <span className="vocab-vault-tip-shape" />
      {TIP_COPY[kind].split(" ").map((word, index) => (
        <span
          key={`${word}-${index}`}
          className="vocab-vault-word"
          style={{ "--i": index } as CSSProperties}
        >
          {word}
        </span>
      ))}
    </span>
  );
}

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
  compact,
  onRemove,
}: {
  entry: SavedWord;
  flag: string;
  /** Compact list: the word alone until the reader asks for the rest. */
  compact: boolean;
  onRemove: () => void;
}) {
  const [shift, setShift] = useState(0);
  const [revealed, setRevealed] = useState(false);
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
    // A tap is what is LEFT once the two destructive gestures are ruled out: the
    // long-press already fired (settled) or the finger travelled far enough to be
    // a swipe. Only then does it mean "show me the meaning".
    const tapped = compact && !settled.current && Math.abs(shift) <= 8;
    reset();
    if (tapped) setRevealed((on) => !on);
  }

  function onKeyDown(event: KeyboardEvent<HTMLLIElement>) {
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      onRemove();
      return;
    }
    // The row is the control in compact mode, so it answers to the keys a
    // disclosure normally would.
    if (compact && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      setRevealed((on) => !on);
    }
  }

  /** Everything below the word, withheld until asked for in compact mode. */
  const showDetail = !compact || revealed;

  return (
    <li
      className="vocab-saved-item"
      data-pressing={pressing || undefined}
      data-shifted={shifted || undefined}
      data-reveal={shifted ? (shift < 0 ? "right" : "left") : undefined}
      style={{ "--row-shift": `${shift}px` } as CSSProperties}
      data-compact={compact || undefined}
      tabIndex={0}
      aria-expanded={compact ? revealed : undefined}
      aria-label={
        compact
          ? `${entry.word.word} — chạm để xem nghĩa, vuốt ngang hoặc nhấn giữ để ${flag.toLowerCase()}`
          : `${entry.word.word} — vuốt ngang hoặc nhấn giữ để ${flag.toLowerCase()}`
      }
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
          {showDetail && (
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
          )}
          {compact && <ChevronDown className="vocab-saved-peek" size={16} aria-hidden="true" />}
        </div>

        {showDetail && (
          <>
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
          </>
        )}
      </div>
    </li>
  );
}

/** Group heading plus its folders; a folder only appears when the group outgrows one. */
function SavedFolders({
  groups,
  flag,
  compact,
  onRemove,
}: {
  groups: WordGroup[];
  flag: string;
  compact: boolean;
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
                  compact={compact}
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
                      compact={compact}
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

/**
 * Show this device's saved words as folders, with a swipe/hold gesture to un-save.
 * @param onClose Present when the list is embedded in the feed's saved drawer
 *   rather than standing as its own route: the shell drops to a plain div (a
 *   second <main> inside the feed's would be invalid) and the leading control
 *   becomes a close button instead of a link back to the feed.
 */
export function BookmarksPage({ onClose }: { onClose?: () => void } = {}) {
  const { saved, favorites, remove, restore } = useSavedWords();
  const [tab, setTab] = useState<TabKind>("bookmark");
  // Compact is the resting state: the list is a self-test first — word alone, meaning on
  // tap — and the per-tab toggle below opens it out again.
  const [compact, setCompact] = useState(true);
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
  // Filed by day, always. Grouping by level was a second switch for something the reader
  // never changed, so the list keeps the one order that matches how it was collected.
  const groups = groupSavedWords(rows, "day");
  const empty = EMPTY_COPY[tab];

  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), UNDO_MS);
    return () => window.clearTimeout(timer);
  }, [undo]);

  /** A tablist is expected to move between tabs with the arrow keys. */
  function onTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    // The density button sits in this row too: arrows pressed on it belong to it, not to
    // the tablist, or the list would switch lists under the reader's finger.
    if (!(event.target as HTMLElement).closest('[role="tab"]')) return;
    event.preventDefault();
    const at = TABS.findIndex((item) => item.kind === tab);
    const step = event.key === "ArrowRight" ? 1 : -1;
    setTab(TABS[(at + step + TABS.length) % TABS.length].kind);
  }

  function handleRemove(entry: SavedWord) {
    setUndo({ word: entry.word.word, id: entry.word.id, kind: tab, at: entry.savedAt });
    remove(entry.word.id, tab);
  }

  const embedded = Boolean(onClose);
  const Shell = embedded ? "div" : "main";

  return (
    <Shell
      className={`vocabulary-shell vocab-saved-shell${embedded ? " vocab-saved-embedded" : ""}`}
    >
      <header className="vocab-saved-header">
        {onClose ? (
          <button
            type="button"
            className="vocab-icon-button"
            onClick={onClose}
            aria-label="Đóng từ vựng đã lưu"
          >
            <X size={19} />
          </button>
        ) : (
          <Link className="vocab-icon-button" to="/feed" aria-label="Về luồng từ vựng">
            <ArrowLeft size={19} />
          </Link>
        )}
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
        {TABS.map((item) => {
          // The density control belongs to the list that is open, so it rides on the active
          // tab itself rather than standing in a switch row of its own. It is withheld until
          // there is something to expand.
          const fused = tab === item.kind && rows.length > 0;
          return (
            <Fragment key={item.kind}>
              <button
                type="button"
                role="tab"
                id={`${groupId}-tab-${item.kind}`}
                aria-selected={tab === item.kind}
                aria-controls={`${groupId}-panel`}
                tabIndex={tab === item.kind ? 0 : -1}
                className="vocab-saved-tab"
                data-on={tab === item.kind || undefined}
                data-fused={fused || undefined}
                onClick={() => setTab(item.kind)}
              >
                {item.kind === "bookmark" ? <Bookmark size={15} /> : <Heart size={15} />}
                {item.label}
                <span className="vocab-saved-tab-count">{counts[item.kind]}</span>
              </button>
              {fused && (
                <button
                  type="button"
                  className="vocab-saved-density"
                  aria-pressed={!compact}
                  aria-label={compact ? "Mở rộng danh sách" : "Thu gọn danh sách"}
                  title={compact ? "Mở rộng danh sách" : "Thu gọn danh sách"}
                  onClick={() => setCompact((value) => !value)}
                >
                  {compact ? (
                    <ChevronsUpDown size={15} aria-hidden="true" />
                  ) : (
                    <FoldVertical size={15} aria-hidden="true" />
                  )}
                </button>
              )}
            </Fragment>
          );
        })}
      </div>

      {rows.length ? (
        <div
          id={`${groupId}-panel`}
          role="tabpanel"
          aria-labelledby={`${groupId}-tab-${tab}`}
          className="vocab-saved-body"
        >
          <p className="vocab-saved-hint">
            {compact ? "Chạm một từ để xem nghĩa. " : ""}Vuốt ngang hoặc nhấn giữ một từ để{" "}
            {REMOVE_COPY[tab].flag.toLowerCase()}.
          </p>
          <SavedFolders
            groups={groups}
            flag={REMOVE_COPY[tab].flag}
            compact={compact}
            onRemove={handleRemove}
          />
        </div>
      ) : (
        <div
          className="vocab-saved-empty"
          role="tabpanel"
          id={`${groupId}-panel`}
          aria-labelledby={`${groupId}-tab-${tab}`}
        >
          {/* The empty list is the one screen that has to TEACH the gesture, so instead of a
              lone grey glyph it shows the vault doing its job: the two buttons the reader
              will actually tap, a word-chip dropping from the one this tab belongs to, and
              the jar catching it. Entirely decorative — the heading and body below say the
              same thing in words, so a screen reader loses nothing by skipping it. */}
          <div className="vocab-vault" data-kind={tab} aria-hidden="true">
            {/* One tooltip per key. Each is centred on its own key — the bookmark held above,
                the heart directly underneath — so each tail points straight at its icon's
                midpoint and the pair reads symmetrically about the centre line. */}
            <VaultTip kind="heart" />
            <VaultTip kind="bookmark" />
            {/* Heart first, then bookmark — the same order the two buttons sit in under every
                word in the feed, so the row learned here matches the row they will tap. */}
            <div className="vocab-vault-keys">
              <span className="vocab-vault-key" data-key="heart" data-active>
                <Heart size={17} strokeWidth={2.2} />
              </span>
              <span className="vocab-vault-key" data-key="bookmark" data-active>
                <Bookmark size={17} strokeWidth={2.2} />
              </span>
            </div>
            {/* The mouth, BEHIND the chips, so a block stays bright while it sinks into the
                opening and is masked by the bowl's near (lower) rim, not the top arc. */}
            <span className="vocab-vault-lid" />
            {/* Two blocks drop into the jar — one per reaction — so the scene teaches both
                gestures at once instead of one per tab. The heart's is pink. */}
            <span className="vocab-vault-chip" data-chip="bookmark" />
            <span className="vocab-vault-chip" data-chip="heart" />
            <div className="vocab-vault-jar">
              {/* The bowl's front wall is its own layer so it can be masked: its top edge has
                  to BE the opening's lower arc, and a mask on the jar itself would also eat
                  the sparks and the halo that sit outside the bowl. */}
              <span className="vocab-vault-body" />
              <span className="vocab-vault-shine" />
              <span className="vocab-vault-spark" data-s="1" />
              <span className="vocab-vault-spark" data-s="2" />
              <span className="vocab-vault-spark" data-s="3" />
            </div>
          </div>
          <h2>{empty.title}</h2>
          {/* Two lengths, one shown at a time: a landscape phone drops the bowl and
              most of the scene, so the instruction has to carry itself in one line. */}
          <p className="vocab-saved-empty-long">{empty.body}</p>
          <p className="vocab-saved-empty-short">{empty.short}</p>
          {/* In the drawer the feed is already behind the panel, so the way
              back is to close it — a link to /feed would be a dead button. */}
          {onClose ? (
            <button type="button" className="vocab-light-button" onClick={onClose}>
              Về luồng từ vựng
            </button>
          ) : (
            <Link className="vocab-light-button" to="/feed">
              Về luồng từ vựng
            </Link>
          )}
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
    </Shell>
  );
}
