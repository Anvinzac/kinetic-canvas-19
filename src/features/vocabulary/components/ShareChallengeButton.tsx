/**
 * The "challenge a friend" button on the meaning panel.
 *
 * Sends the word's share link (`/w/<code>`), never the word: the whole point is
 * that the message gives nothing away, so the receiver has to guess. The link is
 * always put on the clipboard first — so there is a fallback even if the sheet is
 * dismissed — and on a phone the native share sheet is then raised on top of it as
 * the fastest route into a chat thread.
 *
 * The shape — a tab cropped flush into the panel's bottom-right corner — is entirely
 * vocabulary.css's; this file only supplies the boxes it paints.
 *
 * Exports: ShareChallengeButton
 * Depends on: lucide icons, vocabulary.css
 */

import { useEffect, useRef, useState } from "react";
import { Check, Share2 } from "lucide-react";

/** How long the confirmation stays up before the button returns to its idle face. */
const CONFIRM_MS = 2200;

/** What goes in the message. Deliberately free of the answer. */
function challengeText(url: string): string {
  return `Đoán thử từ này xem\n${url}`;
}

/**
 * Share this word as a guessing challenge.
 * @param props.code The word's share code; absent, nothing renders.
 * @returns The button, or null when the word has no code yet.
 */
export function ShareChallengeButton({ code }: { code?: string }): React.ReactElement | null {
  const [done, setDone] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  if (!code) return null;

  const confirm = () => {
    setDone(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setDone(false), CONFIRM_MS);
  };

  async function share() {
    const url = `${window.location.origin}/w/${code}`;
    const text = challengeText(url);
    // Copy the bare link first, always: no teaser text, just the URL, so a paste
    // anywhere is clean. This guarantees the link survives even when the share
    // sheet is cancelled or the platform has no sheet at all. clipboard.writeText
    // does not consume the tap's transient activation, so navigator.share below
    // is still allowed to open.
    try {
      await navigator.clipboard.writeText(url);
      confirm();
    } catch {
      // Clipboard blocked (insecure context / permission denied): fall through to
      // the share sheet, which carries the same link, rather than doing nothing.
    }
    // Then raise the native sheet where there is one, with the teaser message.
    // It resolves on close and rejects on cancel — neither is worth reporting,
    // since the link is already copied.
    if (navigator.share) {
      try {
        await navigator.share({ title: "Đoán từ này đi!", text });
      } catch {
        // Dismissed by the user; the clipboard already has the link.
      }
    }
  }

  return (
    <div className="vocab-share-dock">
      <button
        type="button"
        className="vocab-share-button"
        data-done={done || undefined}
        onClick={share}
        aria-label={done ? "Đã chép link thách đố" : "Chia sẻ để thách bạn bè đoán từ này"}
        title="Thách bạn bè đoán từ này"
      >
        <span className="vocab-share-face-bg" aria-hidden="true" />
        <span className="vocab-share-face">
          {done ? <Check size={15} /> : <Share2 size={15} />}
          <span className="vocab-share-label">{done ? "Đã chép!" : "Chia sẻ"}</span>
        </span>
      </button>
    </div>
  );
}
