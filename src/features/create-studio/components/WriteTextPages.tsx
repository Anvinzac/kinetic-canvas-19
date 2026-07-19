/**
 * Multi-page sentence textareas for the create-studio write panel.
 *
 * Exports: WriteTextPages
 * Depends on: page-backdrop helpers, composer-pages
 */

import { Plus, X } from "lucide-react";
import type { Dispatch, ReactElement, RefObject, SetStateAction } from "react";
import type { CanvasSpec } from "@/features/canvas";
import { MAX_STATUS_CHARS } from "../lib/composer-pages";
import type { BackgroundMode } from "../types";
import { getPageBackdropActionIcon, getPageBackdropActionLabel } from "./page-backdrop";

export type WriteTextPagesProps = {
  composerPages: string[];
  activeTextPage: number;
  backgroundMode: BackgroundMode;
  selectTextPage: (pageIndex: number) => void;
  openPageBackdropEditor: (pageIndex: number) => void;
  removeTextPage: (pageIndex: number) => void;
  insertTextPageAfter: (pageIndex: number) => void;
  updateTextPage: (pageIndex: number, value: string) => void;
  setActiveTextPage: Dispatch<SetStateAction<number>>;
  setPreviewAnimating: Dispatch<SetStateAction<boolean>>;
  textareaRefs: RefObject<Array<HTMLTextAreaElement | null>>;
  spec: CanvasSpec;
};

/**
 * Render editable status pages with backdrop and remove controls.
 * @param props - Page list, focus/edit handlers, and char budget
 * @returns Page editor stack
 */
export function WriteTextPages({
  composerPages,
  activeTextPage,
  backgroundMode,
  selectTextPage,
  openPageBackdropEditor,
  removeTextPage,
  insertTextPageAfter,
  updateTextPage,
  setActiveTextPage,
  setPreviewAnimating,
  textareaRefs,
  spec,
}: WriteTextPagesProps): ReactElement {
  return (
    <>
      <div className="space-y-2">
        {composerPages.map((pageText, pageIndex) => (
          <div
            key={pageIndex}
            onClick={() => selectTextPage(pageIndex)}
            className={`rounded-2xl p-2 ring-1 transition ${
              activeTextPage === pageIndex
                ? "bg-white/[0.08] ring-primary/70"
                : "bg-white/[0.04] ring-white/10 hover:bg-white/[0.06]"
            }`}
          >
            <div className="mb-1.5 flex items-center justify-between px-1 font-mono text-[10px] uppercase tracking-[0.16em]">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  selectTextPage(pageIndex);
                }}
                className={
                  activeTextPage === pageIndex
                    ? "text-white"
                    : "text-muted-foreground transition hover:text-white"
                }
              >
                page {pageIndex + 1}
              </button>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    openPageBackdropEditor(pageIndex);
                  }}
                  className="flex h-6 items-center gap-1 rounded-full bg-white/8 px-2 text-[9px] font-bold text-white/70 ring-1 ring-white/10 transition hover:bg-white/12 hover:text-white"
                  aria-label={`${getPageBackdropActionLabel(backgroundMode)} for page ${
                    pageIndex + 1
                  }`}
                >
                  {getPageBackdropActionIcon(backgroundMode)}
                  {getPageBackdropActionLabel(backgroundMode)}
                </button>
                {composerPages.length > 1 && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeTextPage(pageIndex);
                    }}
                    className="grid size-6 place-items-center rounded-full text-muted-foreground transition hover:bg-white/10 hover:text-white"
                    aria-label={`Remove page ${pageIndex + 1}`}
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
            <textarea
              ref={(el) => {
                textareaRefs.current[pageIndex] = el;
              }}
              value={pageText}
              onFocus={() => {
                setActiveTextPage(pageIndex);
                setPreviewAnimating(false);
              }}
              onChange={(event) => updateTextPage(pageIndex, event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                if (!pageText.trim()) return;
                insertTextPageAfter(pageIndex);
              }}
              rows={2}
              placeholder={pageIndex === 0 ? "write one sentence or argument..." : "next page..."}
              className="block w-full resize-none overflow-y-auto rounded-xl bg-black/20 px-3 py-2.5 text-base leading-relaxed text-white outline-none placeholder:text-white/35"
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => insertTextPageAfter(activeTextPage)}
        disabled={spec.text.length >= MAX_STATUS_CHARS}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/8 px-3 py-2 text-xs font-bold text-white ring-1 ring-white/10 transition hover:bg-white/12 disabled:opacity-40"
      >
        <Plus className="size-3.5" />
        add page
      </button>
      <div className="mt-2 flex items-center justify-end font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        <span>
          {spec.text.length}/{MAX_STATUS_CHARS}
        </span>
      </div>
    </>
  );
}
