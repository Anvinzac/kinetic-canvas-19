/**
 * On-device saved-words listing. Reads this browser's bookmarks from
 * localStorage and resolves them against the bundled catalog — no account,
 * no sign-in, no server round-trip.
 *
 * Exports: BookmarksPage
 * Depends on: router Link, lucide icons, useBookmarks, reactions, vocabulary.css
 */

import { Link } from "@tanstack/react-router";
import { ArrowLeft, Bookmark, Heart } from "lucide-react";
import { useBookmarks } from "../hooks/useBookmarks";
import { flipReaction } from "../lib/reactions";
import { FilledUsage, MarkedText } from "./MarkedText";
import "../vocabulary.css";

/** Show every word this device bookmarked. @returns Public saved-words page. */
export function BookmarksPage() {
  const { saved, unbookmark, refresh } = useBookmarks();

  /** Heart toggles do not change membership, so only the local row needs a re-read. */
  const toggleHeart = (wordId: string) => {
    flipReaction(wordId, "heart");
    refresh();
  };

  return (
    <main className="vocabulary-shell vocab-saved-shell">
      <header className="vocab-saved-header">
        <Link className="vocab-icon-button" to="/feed" aria-label="Back to the word stream">
          <ArrowLeft size={19} />
        </Link>
        <div>
          <h1 className="vocab-saved-title">Saved words</h1>
          <p className="vocab-saved-subtitle">
            {saved.length
              ? `${saved.length} word${saved.length === 1 ? "" : "s"} saved on this device.`
              : "Stored on this device only — no account, no sign-in."}
          </p>
        </div>
      </header>

      {saved.length ? (
        <ul className="vocab-saved-list">
          {saved.map((entry) => (
            <li className="vocab-saved-item" key={entry.word.id}>
              <div className="vocab-saved-word-row">
                <h2 className="vocab-saved-word" lang="en">
                  {entry.word.word}
                </h2>
                <div className="vocab-saved-badges">
                  {entry.word.level && (
                    <span className="vocab-saved-badge">{entry.word.level}</span>
                  )}
                  {entry.word.pos && <span className="vocab-saved-badge">{entry.word.pos}</span>}
                  {entry.word.topic && (
                    <span className="vocab-saved-badge">{entry.word.topic}</span>
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
                <div className="vocab-saved-usage">
                  <p lang="en">
                    <FilledUsage text={entry.word.usage[0].en} word={entry.word.word} />
                  </p>
                  {entry.word.usage[0].vi && (
                    <p lang="vi">
                      <MarkedText text={entry.word.usage[0].vi} />
                    </p>
                  )}
                </div>
              )}

              <div className="vocab-saved-actions">
                <button
                  type="button"
                  className="vocab-reaction-button vocab-reaction-heart"
                  data-on={entry.hearted || undefined}
                  onClick={() => toggleHeart(entry.word.id)}
                  aria-label={
                    entry.hearted ? "Remove your heart from this word" : "Heart this word"
                  }
                >
                  <Heart size={17} fill={entry.hearted ? "currentColor" : "none"} />
                </button>
                <span className="vocab-saved-taps">
                  <span aria-hidden="true">{entry.heartTaps || ""}</span>
                  <span className="sr-only">{entry.heartTaps} local heart taps</span>
                </span>
                <button
                  type="button"
                  className="vocab-reaction-button vocab-saved-remove"
                  onClick={() => unbookmark(entry.word.id)}
                  aria-label={`Remove ${entry.word.word} from saved words`}
                >
                  <Bookmark size={17} fill="currentColor" />
                </button>
                <span className="vocab-saved-taps">
                  <span aria-hidden="true">{entry.bookmarkTaps || ""}</span>
                  <span className="sr-only">{entry.bookmarkTaps} local bookmark taps</span>
                </span>
                {/* Emoji comments left on this word. */}
                {Object.entries(entry.emojis).length > 0 && (
                  <span className="vocab-saved-emojis" aria-label="Emoji comments">
                    {Object.entries(entry.emojis).map(([emoji, count]) => (
                      <span className="vocab-saved-emoji" key={emoji}>
                        <span aria-hidden="true">{emoji}</span>
                        <span className="sr-only">
                          {emoji} {count} time{count === 1 ? "" : "s"}
                        </span>
                        <span className="vocab-saved-emoji-count" aria-hidden="true">
                          {count}
                        </span>
                      </span>
                    ))}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="vocab-saved-empty">
          <Bookmark size={40} strokeWidth={1.4} aria-hidden="true" />
          <h2>No saved words yet</h2>
          <p>Tap the bookmark on any word in the stream to keep it here.</p>
          <Link className="vocab-light-button" to="/feed">
            Back to the stream
          </Link>
        </div>
      )}
    </main>
  );
}
