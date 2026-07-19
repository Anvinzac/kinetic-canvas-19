/**
 * UI component: MasonryCard.
 *
 * Exports: MasonryCard
 * Depends on: @/components/KineticText, @/lib/canvas, @/lib/mock-data, @/features/post-player
 */

import type { ReactElement } from "react";
import { KineticText } from "@/components/KineticText";
import { parseCanvas, resolveCanvasBackground } from "@/lib/canvas";
import type { MockPost } from "@/lib/mock-data";
import { paginateText } from "@/features/post-player";

/**
 * Render the MasonryCard UI.
 * @param props - Component props
 * @returns Rendered UI
 */
export function MasonryCard({ post, className }: { post: MockPost; className?: string }): ReactElement {
  const spec = parseCanvas(post.canvas_html);
  // Show only the first page — a single full sentence laid out exactly as it
  // looks after one run on the canvas — instead of cramming the whole poem into
  // unreadable tiny text.
  const firstPage = paginateText(spec.text)[0] ?? spec.text;
  const previewSpec = { ...spec, text: firstPage };
  const background = resolveCanvasBackground(post.bg_gradient, post.id);
  const media = post.media_urls ?? [];
  const hasImage =
    (post.post_type === "image" || post.post_type === "slideshow") && Boolean(media[0]);

  return (
    <div
      className={`relative overflow-hidden rounded-lg ring-1 ring-white/10 ${className ?? ""}`}
      style={{ background }}
    >
      {hasImage && (
        <img src={media[0]!} alt="" className="absolute inset-0 size-full object-cover" />
      )}
      {post.post_type !== "text" && (
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/55" />
      )}
      <div className="absolute inset-0">
        <KineticText spec={previewSpec} paused scaleToCanvas background={background} />
      </div>
    </div>
  );
}
