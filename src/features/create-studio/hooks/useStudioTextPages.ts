/**
 * Multi-page status text editing for the create-studio composer.
 *
 * Exports: useStudioTextPages
 * Depends on: create-studio lib/composer-pages + size
 */

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import type { CanvasSpec } from "@/features/canvas";
import {
  getComposerPages,
  joinComposerPages,
  MAX_STATUS_CHARS,
} from "../lib/composer-pages";
import { suggestSize } from "../lib/size";
import type { StudioPage } from "../types";

export type StudioTextPagesApi = {
  activeTextPage: number;
  setActiveTextPage: Dispatch<SetStateAction<number>>;
  textareaRefs: RefObject<Array<HTMLTextAreaElement | null>>;
  composerPages: string[];
  currentTextPage: string;
  publishText: string;
  updateTextPage: (pageIndex: number, value: string) => void;
  insertTextPageAfter: (pageIndex: number) => void;
  removeTextPage: (pageIndex: number) => void;
  selectTextPage: (pageIndex: number) => void;
  openPageBackdropEditor: (pageIndex: number) => void;
};

type UseStudioTextPagesArgs = {
  spec: CanvasSpec;
  setSpec: Dispatch<SetStateAction<CanvasSpec>>;
  setPreviewAnimating: Dispatch<SetStateAction<boolean>>;
  onAccentReset: () => void;
  setActivePage: Dispatch<SetStateAction<StudioPage>>;
};

/**
 * Manage composer text pages, focus, and page-backdrop navigation.
 * @param args - Spec mutators and preview/accent resetters from the page shell
 * @returns Text-page state and handlers
 */
export function useStudioTextPages({
  spec,
  setSpec,
  setPreviewAnimating,
  onAccentReset,
  setActivePage,
}: UseStudioTextPagesArgs): StudioTextPagesApi {
  const [activeTextPage, setActiveTextPage] = useState(0);
  const textareaRefs = useRef<Array<HTMLTextAreaElement | null>>([]);

  const composerPages = getComposerPages(spec.text);
  const currentTextPage = composerPages[activeTextPage] ?? composerPages[0] ?? "";
  const publishText = composerPages
    .map((page) => page.trim())
    .filter(Boolean)
    .join("\n");

  useEffect(() => {
    textareaRefs.current.forEach((el) => {
      if (!el) return;
      el.style.height = "0px";
      el.style.height = `${Math.min(Math.max(el.scrollHeight, 56), 180)}px`;
    });
  }, [spec.text]);

  useEffect(() => {
    if (activeTextPage >= composerPages.length) {
      setActiveTextPage(Math.max(0, composerPages.length - 1));
    }
  }, [activeTextPage, composerPages.length]);

  function updateTextPage(pageIndex: number, value: string): void {
    const pieces = value.replace(/\r\n?/g, "\n").split("\n");
    const nextPage = pageIndex + Math.max(0, pieces.length - 1);
    const previewPages = [...composerPages];
    previewPages.splice(pageIndex, 1, ...pieces);
    const limitedPreviewPages = getComposerPages(joinComposerPages(previewPages));
    const focusedPage = Math.min(nextPage, limitedPreviewPages.length - 1);

    setSpec((s) => {
      const pages = getComposerPages(s.text);
      pages.splice(pageIndex, 1, ...pieces);
      const limitedText = joinComposerPages(pages);
      const limitedPages = getComposerPages(limitedText);
      const focusedText = limitedPages[Math.min(nextPage, limitedPages.length - 1)] ?? "";
      return { ...s, text: limitedText, size: suggestSize(focusedText, s.size) };
    });

    setActiveTextPage(focusedPage);
    setPreviewAnimating(false);
    onAccentReset();
    if (pieces.length > 1) {
      window.setTimeout(() => textareaRefs.current[focusedPage]?.focus(), 0);
    }
  }

  function insertTextPageAfter(pageIndex: number): void {
    if (spec.text.length >= MAX_STATUS_CHARS) return;
    const nextPage = pageIndex + 1;
    setSpec((s) => {
      const pages = getComposerPages(s.text);
      pages.splice(nextPage, 0, "");
      return { ...s, text: joinComposerPages(pages) };
    });
    setActiveTextPage(nextPage);
    setPreviewAnimating(false);
    onAccentReset();
    window.setTimeout(() => textareaRefs.current[nextPage]?.focus(), 0);
  }

  function removeTextPage(pageIndex: number): void {
    setSpec((s) => {
      const pages = getComposerPages(s.text);
      if (pages.length <= 1) return { ...s, text: "" };
      pages.splice(pageIndex, 1);
      return { ...s, text: joinComposerPages(pages) };
    });
    setActiveTextPage((page) => Math.max(0, Math.min(page, composerPages.length - 2)));
    setPreviewAnimating(false);
    onAccentReset();
  }

  function selectTextPage(pageIndex: number): void {
    setActiveTextPage(pageIndex);
    setPreviewAnimating(false);
    window.setTimeout(() => textareaRefs.current[pageIndex]?.focus(), 0);
  }

  function openPageBackdropEditor(pageIndex: number): void {
    setActiveTextPage(pageIndex);
    setPreviewAnimating(false);
    setActivePage("background");
  }

  return {
    activeTextPage,
    setActiveTextPage,
    textareaRefs,
    composerPages,
    currentTextPage,
    publishText,
    updateTextPage,
    insertTextPageAfter,
    removeTextPage,
    selectTextPage,
    openPageBackdropEditor,
  };
}
