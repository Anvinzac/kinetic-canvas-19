/**
 * Bottom-left post meta: article chip, hashtags, views, and date.
 *
 * Exports: PostInfoBlock
 * Depends on: lucide Link2/ArrowUpRight, post-meta formatters
 */

import { ArrowUpRight, Link2 } from "lucide-react";
import type { ReactElement } from "react";
import type { CanvasLinkPreview } from "@/lib/canvas";
import { formatCompactCount, formatPostDate } from "../lib/post-meta";

export type PostInfoBlockProps = {
  isExporting: boolean;
  commentOverlapsInfo: boolean;
  articlePreview: CanvasLinkPreview | null;
  postHashtags: string[];
  viewCount: number;
  createdAt: string;
};

/**
 * Show post metadata in the bottom-left safe corner.
 * @param props - PostInfoBlockProps fields
 * @returns Rendered UI
 */
export function PostInfoBlock({
  isExporting,
  commentOverlapsInfo,
  articlePreview,
  postHashtags,
  viewCount,
  createdAt,
}: PostInfoBlockProps): ReactElement | null {
  if (isExporting) return null;

  return (
    <div
      className={`absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] z-20 max-w-[min(70%,260px)] text-white transition-opacity duration-300 ${
        commentOverlapsInfo ? "opacity-20" : "opacity-100"
      }`}
    >
      {articlePreview && (
        <a
          href={articlePreview.url}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
          aria-label={`Open article on ${articlePreview.host}`}
          className="group mb-3 inline-flex max-w-full items-center gap-2 rounded-full bg-white py-1.5 pl-2.5 pr-2 text-[10.5px] font-bold uppercase tracking-[0.16em] text-black shadow-[0_14px_38px_rgba(0,0,0,0.55)] ring-1 ring-black/5 transition active:scale-[0.97]"
        >
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-black/[0.06]">
            <Link2 className="size-3" />
          </span>
          <span className="truncate font-mono text-[10px] font-semibold normal-case tracking-tight text-black/65">
            {articlePreview.host}
          </span>
          <ArrowUpRight className="size-3.5 shrink-0 text-black/55 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </a>
      )}

      {postHashtags.length > 0 && (
        <div className="mb-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {postHashtags.map((tag) => (
            <span
              key={tag}
              className="font-mono text-[11px] font-black uppercase leading-none tracking-[0.16em] text-white"
              style={{
                textShadow: "0 1px 12px rgba(0,0,0,0.6), 0 1px 2px rgba(0,0,0,0.7)",
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      <p
        className="flex items-baseline gap-1.5 font-mono text-[9.5px] uppercase leading-none tracking-[0.22em] text-white/65"
        style={{ textShadow: "0 1px 8px rgba(0,0,0,0.55)" }}
      >
        <span className="text-white/90">{formatCompactCount(viewCount)} views</span>
        <span className="text-white/30">·</span>
        <span>{formatPostDate(createdAt)}</span>
      </p>
    </div>
  );
}
