/**
 * Optional article URL attach UI inside the write panel.
 *
 * Exports: WriteArticleLink
 * Depends on: ArticleClip
 */

import { ChevronRight, Link2 } from "lucide-react";
import type { Dispatch, ReactElement, SetStateAction } from "react";
import { ArticleClip } from "./ArticleClip";

export type WriteArticleLinkProps = {
  articleOpen: boolean;
  setArticleOpen: Dispatch<SetStateAction<boolean>>;
  articleUrl: string;
  setArticleUrl: Dispatch<SetStateAction<string>>;
  articleInvalid: boolean;
  articlePreview: { url: string; host: string; title: string } | null;
};

/**
 * Toggle and edit an optional article link attachment.
 * @param props - Article open/url/validation state
 * @returns Article link section
 */
export function WriteArticleLink({
  articleOpen,
  setArticleOpen,
  articleUrl,
  setArticleUrl,
  articleInvalid,
  articlePreview,
}: WriteArticleLinkProps): ReactElement {
  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <button
        type="button"
        onClick={() => setArticleOpen((open) => !open)}
        aria-expanded={articleOpen}
        className={`flex w-full items-center gap-2.5 rounded-2xl px-2.5 py-2 text-left transition ${
          articleOpen || articlePreview
            ? "bg-white/[0.07] ring-1 ring-white/15"
            : "bg-transparent hover:bg-white/[0.04]"
        }`}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/10 text-white/80">
          <Link2 className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold text-white">
            {articlePreview ? "article link attached" : "attach article link"}
          </span>
          <span className="block truncate font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
            {articlePreview ? articlePreview.host : "optional · turns this into a link post"}
          </span>
        </span>
        <ChevronRight
          className={`size-4 shrink-0 text-muted-foreground transition ${
            articleOpen ? "rotate-90" : ""
          }`}
        />
      </button>
      {articleOpen && (
        <div className="mt-2 space-y-2">
          <input
            value={articleUrl}
            onChange={(event) => setArticleUrl(event.target.value)}
            placeholder="https://example.com/article"
            inputMode="url"
            autoComplete="off"
            className={`w-full rounded-2xl bg-white/7 px-4 py-3 text-sm text-white outline-none ring-1 placeholder:text-white/35 focus:ring-primary/70 ${
              articleInvalid ? "ring-rose-400/70" : "ring-white/10"
            }`}
          />
          {articleInvalid && (
            <p className="px-1 font-mono text-[10px] uppercase tracking-[0.16em] text-rose-300/85">
              link doesn't look valid yet
            </p>
          )}
          {articlePreview && <ArticleClip preview={articlePreview} />}
        </div>
      )}
    </div>
  );
}
