/**
 * Floating emoji comment rail on the right edge of a vocabulary card. After the
 * word is revealed, the reader can tap emojis from a curated palette to leave
 * them on the word. Each tap increments a cumulative counter stored in the same
 * localStorage record as heart/bookmark reactions.
 *
 * Exports: EmojiReactions, EMOJI_PALETTE
 * Depends on: framer-motion, React, ../lib/reactions
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import {
  REACTIONS_EVENT,
  REACTIONS_KEY,
  addEmojiComment,
  getEmojiComments,
} from "../lib/reactions";

/** The eight emojis the reader can leave on any word. */
export const EMOJI_PALETTE = ["🔥", "💡", "🤔", "❤️", "😂", "👏", "🎉", "💪"] as const;

/**
 * Right-edge overlay: reacted emoji bubbles stacked vertically with a "+"
 * trigger that opens a horizontal picker. Locked (pre-reveal) hides the whole
 * rail so it does not compete with the clue stages.
 */
export function EmojiReactions({
  wordId,
  locked,
  reducedMotion,
}: {
  wordId: string;
  locked: boolean;
  reducedMotion: boolean;
}) {
  const [emojis, setEmojis] = useState(() => getEmojiComments(wordId));
  const [pickerOpen, setPickerOpen] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);

  // Re-read when the reactions store changes (same-tab custom event or cross-tab).
  const refresh = useCallback(() => setEmojis(getEmojiComments(wordId)), [wordId]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === REACTIONS_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(REACTIONS_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(REACTIONS_EVENT, refresh);
    };
  }, [refresh]);

  // Close the picker when a tap lands outside the rail.
  useEffect(() => {
    if (!pickerOpen) return;
    const onDocTap = (event: MouseEvent | TouchEvent) => {
      if (railRef.current && !railRef.current.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocTap);
    document.addEventListener("touchstart", onDocTap);
    return () => {
      document.removeEventListener("mousedown", onDocTap);
      document.removeEventListener("touchstart", onDocTap);
    };
  }, [pickerOpen]);

  // Reset the picker when a new word mounts.
  useEffect(() => {
    setPickerOpen(false);
  }, [wordId]);

  const handleEmojiTap = (emoji: string) => {
    addEmojiComment(wordId, emoji);
    setPickerOpen(false);
  };

  const reacted = Object.entries(emojis).filter(([, count]) => count > 0);

  if (locked) return null;

  return (
    <div ref={railRef} className="vocab-emoji-rail" data-no-gesture aria-label="Emoji comments">
      {/* Reacted emoji bubbles, most-recent last so new taps land near the trigger. */}
      {reacted.map(([emoji, count]) => (
        <button
          key={emoji}
          type="button"
          className="vocab-emoji-bubble"
          onClick={() => handleEmojiTap(emoji)}
          aria-label={`${emoji} tapped ${count} time${count === 1 ? "" : "s"}. Tap to add another.`}
        >
          <span className="vocab-emoji-glyph" aria-hidden="true">
            {emoji}
          </span>
          <span className="vocab-emoji-count">{count}</span>
        </button>
      ))}

      {/* Picker trigger: a "+" circle that toggles the palette. */}
      <button
        type="button"
        className="vocab-emoji-trigger"
        data-open={pickerOpen || undefined}
        onClick={() => setPickerOpen((prev) => !prev)}
        aria-label={pickerOpen ? "Close emoji picker" : "Add an emoji comment"}
        aria-expanded={pickerOpen}
      >
        <Plus size={18} />
      </button>

      {/* Picker popover: horizontal row of palette emojis. */}
      <AnimatePresence>
        {pickerOpen && (
          <motion.div
            className="vocab-emoji-picker"
            initial={reducedMotion ? false : { opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: reducedMotion ? 0 : 0.2, ease: "easeOut" }}
            role="group"
            aria-label="Choose an emoji"
          >
            {EMOJI_PALETTE.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="vocab-emoji-picker-btn"
                onClick={() => handleEmojiTap(emoji)}
                aria-label={`Leave a ${emoji} comment`}
              >
                {emoji}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
