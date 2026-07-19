import { ExternalLink, Newspaper } from "lucide-react";
import type { CanvasLinkPreview } from "@/features/canvas";

export function ArticleClip({ preview, className }: { preview: CanvasLinkPreview; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-md bg-[#f5f0df] p-3 text-[#17140f] shadow-[0_14px_35px_rgba(0,0,0,0.28)] ring-1 ring-black/10 ${
        className ?? ""
      }`}
      style={{
        clipPath: "polygon(0 0,100% 0,100% 88%,97% 88%,97% 100%,88% 92%,0 92%,0 62%,2% 60%,0 58%)",
      }}
    >
      <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(#000_1px,transparent_1px)] [background-size:100%_7px]" />
      <div className="relative">
        <div className="flex items-center justify-between border-b border-black/30 pb-1 font-serif text-[10px] font-black uppercase tracking-[0.18em]">
          <span>Article clipping</span>
          <Newspaper className="size-3.5" />
        </div>
        <div className="mt-2 grid grid-cols-[1fr_34px] gap-2">
          <div className="min-w-0">
            <p className="line-clamp-2 font-serif text-base font-black leading-[0.95]">
              {preview.title}
            </p>
            <p className="mt-1 truncate font-mono text-[9px] uppercase tracking-[0.14em] text-black/55">
              {preview.host}
            </p>
          </div>
          <span className="grid size-8 place-items-center rounded-sm border border-black/25 bg-black/10">
            <ExternalLink className="size-4" />
          </span>
        </div>
      </div>
    </div>
  );
}
