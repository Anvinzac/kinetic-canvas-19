/**
 * Write page: style shortcuts, multi-page sentence editor, accents, article link.
 *
 * Exports: WritePanel
 * Depends on: WriteTextPages, WriteArticleLink, AccentRecommendationCard
 */

import { Move, Palette, Sparkles, Type } from "lucide-react";
import type { Dispatch, ReactElement, RefObject, SetStateAction } from "react";
import type { CanvasSpec } from "@/features/canvas";
import type { AccentRecommendation } from "../lib/accent-suggestions";
import type { BackgroundMode, StudioPage } from "../types";
import { AccentRecommendationCard } from "./AccentRecommendationCard";
import { Panel } from "./Panel";
import { StudioLink } from "./StudioLink";
import { WriteArticleLink } from "./WriteArticleLink";
import { WriteTextPages } from "./WriteTextPages";

export type WritePanelProps = {
  backgroundSummary: string;
  fontSummary: string;
  colorSummary: string;
  layoutSummary: string;
  motionSummary: string;
  setActivePage: Dispatch<SetStateAction<StudioPage>>;
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
  accentRecommendation: AccentRecommendation | null;
  accentLoading: boolean;
  acceptEmojiAccent: () => void;
  rejectAccent: () => void;
  removeAccent: (id: string) => void;
  articleOpen: boolean;
  setArticleOpen: Dispatch<SetStateAction<boolean>>;
  articleUrl: string;
  setArticleUrl: Dispatch<SetStateAction<string>>;
  articleInvalid: boolean;
  articlePreview: { url: string; host: string; title: string } | null;
};

/**
 * Render the write editor panel with style links and text pages.
 * @param props - Summaries, page editors, accents, and article link state
 * @returns Write panel content
 */
export function WritePanel(props: WritePanelProps): ReactElement {
  const {
    backgroundSummary,
    fontSummary,
    colorSummary,
    layoutSummary,
    motionSummary,
    setActivePage,
    accentRecommendation,
    accentLoading,
    acceptEmojiAccent,
    rejectAccent,
    removeAccent,
    articleOpen,
    setArticleOpen,
    articleUrl,
    setArticleUrl,
    articleInvalid,
    articlePreview,
    spec,
  } = props;

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <Sparkles className="size-3.5" />
          edit one thing
        </div>
        <div className="grid gap-2">
          <StudioLink
            icon={<Palette />}
            label="Background"
            value={backgroundSummary}
            onClick={() => setActivePage("background")}
          />
          <StudioLink
            icon={<Type />}
            label="Font"
            value={fontSummary}
            onClick={() => setActivePage("font")}
          />
          <StudioLink
            icon={<Palette />}
            label="Color"
            value={colorSummary}
            onClick={() => setActivePage("color")}
          />
          <StudioLink
            icon={<Move />}
            label="Layout"
            value={layoutSummary}
            onClick={() => setActivePage("layout")}
          />
          <StudioLink
            icon={<Sparkles />}
            label="Motion"
            value={motionSummary}
            onClick={() => setActivePage("motion")}
          />
        </div>
      </section>

      <Panel icon={<Type />} title="sentence">
        <WriteTextPages
          composerPages={props.composerPages}
          activeTextPage={props.activeTextPage}
          backgroundMode={props.backgroundMode}
          selectTextPage={props.selectTextPage}
          openPageBackdropEditor={props.openPageBackdropEditor}
          removeTextPage={props.removeTextPage}
          insertTextPageAfter={props.insertTextPageAfter}
          updateTextPage={props.updateTextPage}
          setActiveTextPage={props.setActiveTextPage}
          setPreviewAnimating={props.setPreviewAnimating}
          textareaRefs={props.textareaRefs}
          spec={spec}
        />
        <AccentRecommendationCard
          recommendation={accentRecommendation}
          loading={accentLoading}
          stickers={spec.stickers ?? []}
          onAcceptEmoji={acceptEmojiAccent}
          onReject={rejectAccent}
          onRemove={removeAccent}
        />
        <WriteArticleLink
          articleOpen={articleOpen}
          setArticleOpen={setArticleOpen}
          articleUrl={articleUrl}
          setArticleUrl={setArticleUrl}
          articleInvalid={articleInvalid}
          articlePreview={articlePreview}
        />
      </Panel>
    </div>
  );
}
