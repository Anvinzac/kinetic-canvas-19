/**
 * Discover search/trending grid helpers (post thumbnails + loaders).
 *
 * Exports: PostGrid, DiscoverLoader
 * Depends on: lib/canvas, mock-data types, lucide-react
 */

import { Newspaper } from "lucide-react";
import { getCanvasTextColor, parseCanvas, resolveCanvasBackground } from "@/lib/canvas";
import type { MockPost } from "@/lib/mock-data";

/**
 * @responsibility Render a 3-column mini canvas grid for discover/search posts.
 * @param posts Posts to thumbnail
 * @param className Optional grid wrapper class
 * @returns Grid of aspect-[3/4] canvas previews
 */
export function PostGrid({ posts, className }: { posts: MockPost[]; className?: string }) {
  return (
    <div className={`grid grid-cols-3 gap-1 ${className ?? ""}`}>
      {posts.map((p) => {
        const spec = parseCanvas(p.canvas_html);
        const background = resolveCanvasBackground(p.bg_gradient, p.id);
        const textColor = getCanvasTextColor(spec, background);
        return (
          <div
            key={p.id}
            className="relative aspect-[3/4] overflow-hidden rounded-md"
            style={{ background }}
          >
            {(p.post_type === "image" || p.post_type === "slideshow") && p.media_urls?.[0] && (
              <img
                src={p.media_urls[0]}
                alt=""
                className="absolute inset-0 size-full object-cover opacity-90"
              />
            )}
            {p.post_type === "link" && <ArticleMiniClip title={spec.link?.title ?? spec.text} />}
            <div
              className="absolute inset-0 flex items-center justify-center p-1 text-center"
              style={{ fontFamily: spec.font, color: textColor, fontWeight: spec.weight }}
            >
              <span className="line-clamp-3 text-[10px] font-bold drop-shadow">{spec.text}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * @responsibility Mini newspaper clip overlay for link-type discover thumbnails.
 */
function ArticleMiniClip({ title }: { title: string }) {
  return (
    <div className="absolute inset-x-1.5 bottom-1.5 z-10 rounded-sm bg-[#f5f0df] p-1.5 text-[#17140f] shadow-lg">
      <div className="mb-0.5 flex items-center justify-between border-b border-black/25 pb-0.5 font-serif text-[6px] font-black uppercase tracking-widest">
        <span>Article</span>
        <Newspaper className="size-2.5" />
      </div>
      <p className="line-clamp-2 font-serif text-[9px] font-black leading-none">{title}</p>
    </div>
  );
}

/**
 * @responsibility Centered aurora pulse used while discover/search data loads.
 * @returns Loading placeholder
 */
export function DiscoverLoader() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="grad-aurora size-10 animate-pulse rounded-full" />
    </div>
  );
}
