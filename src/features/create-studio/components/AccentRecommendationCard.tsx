/**
 * UI component: AccentRecommendationCard.
 *
 * Exports: AccentRecommendationCard
 * Depends on: lucide-react, @/features/canvas
 */

import type { ReactElement } from "react";
import { Smile, Sparkles, X } from "lucide-react";
import type { CanvasSticker } from "@/features/canvas";
import type { AccentRecommendation } from "../lib/accent-suggestions";

/**
 * Render the AccentRecommendationCard UI.
 * @param props - Component props
 * @returns Rendered UI
 */
export function AccentRecommendationCard({
  recommendation,
  loading,
  stickers,
  onAcceptEmoji,
  onReject,
  onRemove,
}: {
  recommendation: AccentRecommendation | null;
  loading: boolean;
  stickers: CanvasSticker[];
  onAcceptEmoji: () => void;
  onReject: () => void;
  onRemove: (id: string) => void;
}): ReactElement | null {
  if (!recommendation && !loading && stickers.length === 0) return null;

  return (
    <div className="mt-3 space-y-2 rounded-2xl bg-black/20 p-2 ring-1 ring-white/10">
      <div className="flex items-center gap-2 px-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        <Smile className="size-3.5" />
        smart accents
      </div>

      {loading && !recommendation && (
        <div className="flex items-center gap-2 rounded-xl bg-white/[0.06] px-3 py-2 text-xs font-bold text-white/70">
          <Sparkles className="size-3.5 animate-pulse" />
          finding a visual match...
        </div>
      )}

      {recommendation && (
        <div className="rounded-xl bg-white/[0.07] p-2 ring-1 ring-white/10">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">
                match "{recommendation.keyword}"
              </p>
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                local emoji suggestion
              </p>
            </div>
            <button
              type="button"
              onClick={onReject}
              className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/15 hover:text-white"
              aria-label="Reject accent recommendation"
            >
              <X className="size-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={onAcceptEmoji}
            className="flex min-h-20 w-full items-center gap-3 rounded-xl bg-white px-3 py-2 text-left text-black transition active:scale-[0.98]"
          >
            <span className="text-4xl leading-none">{recommendation.emoji}</span>
            <span className="min-w-0">
              <span className="block text-xs font-black uppercase">add emoji accent</span>
              <span className="block truncate font-mono text-[9px] uppercase tracking-[0.12em] text-black/55">
                appears beside the matched word
              </span>
            </span>
          </button>
        </div>
      )}

      {stickers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stickers.map((sticker) => (
            <button
              key={sticker.id}
              type="button"
              onClick={() => onRemove(sticker.id)}
              className="flex items-center gap-1.5 rounded-full bg-white/10 py-1 pl-2 pr-1 text-[11px] font-bold text-white ring-1 ring-white/10 transition hover:bg-white/15"
              aria-label={`Remove ${sticker.word} accent`}
            >
              <span>{sticker.kind === "emoji" ? sticker.emoji : "GIF"}</span>
              <span className="max-w-20 truncate">{sticker.word}</span>
              <span className="grid size-5 place-items-center rounded-full bg-black/25">
                <X className="size-3" />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
